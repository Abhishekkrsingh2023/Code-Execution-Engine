"use client";

import { useEffect, useState, useCallback } from "react";
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
  const [solvedIds, setSolvedIds] = useState(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem("code_zero_solved_ids");
      if (stored) {
        setSolvedIds(new Set(JSON.parse(stored)));
      }
    } catch {}
  }, []);

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
    fetchProblems();
  }, [fetchProblems]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    fetchProblems();
  };

  const difficultyBadge = (diff) => {
    switch (diff?.toLowerCase()) {
      case "easy":
        return "text-emerald-400 bg-emerald-950/40 border-emerald-800/40";
      case "medium":
        return "text-amber-400 bg-amber-950/40 border-amber-800/40";
      case "hard":
        return "text-rose-400 bg-rose-950/40 border-rose-800/40";
      default:
        return "text-slate-400 bg-slate-800/40 border-slate-700/40";
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Problems
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse and solve algorithmic challenges across data structures and systems.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-400 bg-[#111622] px-3 py-1.5 rounded-lg border border-slate-800">
          <span>Total:</span>
          <span className="font-semibold text-white font-mono">{total}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#111622] border border-slate-800 rounded-2xl p-4 mb-6 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form
          onSubmit={handleSearchSubmit}
          className="relative flex-1 min-w-[240px]"
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search problems by title, topic..."
            className="w-full pl-9 pr-4 py-2 bg-[#0b0f17] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none"
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

        <div className="flex flex-wrap items-center gap-3">
          {/* Difficulty Filter */}
          <select
            value={difficulty}
            onChange={(e) => {
              setDifficulty(e.target.value);
              setPage(0);
            }}
            className="bg-[#0b0f17] border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchProblems}
            className="px-3 py-1 bg-rose-900/60 hover:bg-rose-900 rounded text-xs text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* Problems Table */}
      <div className="bg-[#111622] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="h-12 bg-slate-800/40 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : problems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-[#0e131d]/60">
                  <th className="py-3.5 px-4 w-16 text-center">Status</th>
                  <th className="py-3.5 px-4 w-16">#</th>
                  <th className="py-3.5 px-4">Title</th>
                  <th className="py-3.5 px-4">Difficulty</th>
                  <th className="py-3.5 px-4">Topic / Tag</th>
                  <th className="py-3.5 px-4 text-right">Time Limit</th>
                  <th className="py-3.5 px-4 text-right w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-sm">
                {problems.map((prob) => {
                  const isSolved = solvedIds.has(prob.id);

                  return (
                    <tr
                      key={prob.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Solved Status */}
                      <td className="py-3.5 px-4 text-center">
                        {isSolved ? (
                          <span
                            title="Solved"
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs"
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
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                        {prob.id}
                      </td>

                      {/* Title */}
                      <td className="py-3.5 px-4 font-medium text-slate-100 group-hover:text-blue-400 transition-colors">
                        <a
                          href={`/problems/${prob.id}`}
                          className="hover:underline"
                        >
                          {prob.title}
                        </a>
                      </td>

                      {/* Difficulty Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${difficultyBadge(
                            prob.difficulty
                          )}`}
                        >
                          {prob.difficulty}
                        </span>
                      </td>

                      {/* Topic / Category */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800/60 text-slate-300 font-medium">
                          {prob.topic || prob.category}
                        </span>
                      </td>

                      {/* Time Limit */}
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-400">
                        {prob.time_limit}s
                      </td>

                      {/* Solve link */}
                      <td className="py-3.5 px-4 text-right">
                        <a
                          href={`/problems/${prob.id}`}
                          className="inline-block px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white transition-all border border-blue-500/30"
                        >
                          Solve
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mx-auto mb-3">
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
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Page <span className="text-white font-semibold">{page + 1}</span> of{" "}
              <span className="text-white font-semibold">{totalPages}</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
