"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const [loading, setLoading] = useState(true);
  const [isPaginating, setIsPaginating] = useState(false);
  const [error, setError] = useState("");
  const tableContainerRef = useRef(null);

  useEffect(() => {
    let ignore = false;

    async function loadLeaderboard() {
      setIsPaginating(true);
      setError("");

      try {
        const params = new URLSearchParams();
        params.set("skip", page * pageSize);
        params.set("limit", pageSize);

        const res = await api.get(`/api-v1/leaderboard?${params.toString()}`);
        if (!ignore) {
          setUsers(res?.users || []);
          setTotal(res?.total || 0);
          if (res?.my_rank) {
            setMyRank(res.my_rank);
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to load global leaderboard.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          setIsPaginating(false);
        }
      }
    }

    loadLeaderboard();

    return () => {
      ignore = true;
    };
  }, [page, pageSize, reloadTrigger]);

  const handlePageChange = (newPage) => {
    if (newPage < 0 || newPage >= totalPages || newPage === page) return;
    setPage(newPage);
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setPage(0);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startItem = total === 0 ? 0 : page * pageSize + 1;
  const endItem = Math.min((page + 1) * pageSize, total);

  // Helper for generating page number buttons with ellipses
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }
    const pages = [];
    if (page <= 3) {
      for (let i = 0; i < 5; i++) pages.push(i);
      pages.push("ellipsis-1");
      pages.push(totalPages - 1);
    } else if (page >= totalPages - 4) {
      pages.push(0);
      pages.push("ellipsis-1");
      for (let i = totalPages - 5; i < totalPages; i++) pages.push(i);
    } else {
      pages.push(0);
      pages.push("ellipsis-1");
      pages.push(page - 1);
      pages.push(page);
      pages.push(page + 1);
      pages.push("ellipsis-2");
      pages.push(totalPages - 1);
    }
    return pages;
  };

  const renderRankBadge = (rank) => {
    if (rank === 1) {
      return (
        <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center justify-center font-bold text-xs shadow-sm shadow-amber-500/20">
          🥇 1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="w-7 h-7 rounded-full bg-slate-300/20 text-slate-200 border border-slate-300/50 flex items-center justify-center font-bold text-xs shadow-sm shadow-slate-300/20">
          🥈 2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="w-7 h-7 rounded-full bg-amber-700/20 text-amber-400 border border-amber-700/50 flex items-center justify-center font-bold text-xs shadow-sm shadow-amber-700/20">
          🥉 3
        </span>
      );
    }
    return <span className="font-mono text-slate-400 text-xs">#{rank}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Leaderboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Global competitive rankings for users based on points and verified problem solutions.
          </p>
        </div>

        {/* Current user rank summary pill */}
        {myRank && (
          <div className="bg-[#111622] border border-blue-500/40 rounded-2xl p-4 flex items-center space-x-4 shadow-md">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-black text-sm">
              #{myRank.rank}
            </div>
            <div>
              <div className="text-xs text-slate-400">Your Standing</div>
              <div className="text-sm font-bold text-white flex items-center space-x-2">
                <span>{myRank.username}</span>
                <span className="text-blue-400 font-mono">
                  ({myRank.total_score} pts)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top Controls Bar */}
      <div className="bg-[#111622] border border-slate-800 rounded-2xl p-4 mb-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span>Total Ranked Competitors:</span>
          <span className="font-semibold text-white font-mono bg-slate-800/80 px-2.5 py-0.5 rounded-lg border border-slate-700/50">
            {total}
          </span>
        </div>

        {/* Page size selector */}
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span>Rows per page:</span>
          <div className="inline-flex rounded-lg bg-[#0b0f17] p-1 border border-slate-800">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => handlePageSizeChange(size)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  pageSize === size
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setReloadTrigger((t) => t + 1)}
            className="px-3 py-1 bg-rose-900/60 hover:bg-rose-900 rounded text-xs text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* Leaderboard Table */}
      <div
        ref={tableContainerRef}
        className="bg-[#111622] border border-slate-800 rounded-2xl overflow-hidden shadow-lg relative"
      >
        {/* Subtle loading overlay during pagination */}
        {isPaginating && (
          <div className="absolute inset-0 bg-[#0b0f17]/40 backdrop-blur-[1px] z-10 flex items-center justify-center transition-opacity">
            <div className="flex items-center space-x-2 bg-slate-900/90 border border-slate-700/80 px-4 py-2 rounded-xl text-xs text-slate-200 shadow-xl">
              <svg
                className="animate-spin h-4 w-4 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span>Updating leaderboard...</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="h-12 bg-slate-800/40 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-[#0e131d]/60">
                  <th className="py-3.5 px-4 w-20 text-center">Rank</th>
                  <th className="py-3.5 px-4">Competitor</th>
                  <th className="py-3.5 px-4 text-right">Problems Solved</th>
                  <th className="py-3.5 px-4 text-right">Attempts</th>
                  <th className="py-3.5 px-4 text-right">Total Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-sm">
                {users.map((entry) => {
                  const isCurrentUser =
                    user?.id === entry.user_id ||
                    user?.username?.toLowerCase() === entry.username?.toLowerCase();

                  return (
                    <tr
                      key={entry.user_id || entry.username}
                      className={`transition-colors ${
                        isCurrentUser
                          ? "bg-blue-950/30 border-l-4 border-l-blue-500 font-medium"
                          : "hover:bg-slate-800/30"
                      }`}
                    >
                      {/* Rank Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex justify-center">
                          {renderRankBadge(entry.rank)}
                        </div>
                      </td>

                      {/* Username */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-slate-100">
                            {entry.username}
                          </span>
                          {isCurrentUser && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600/30 border border-blue-500/50 text-blue-300 font-bold uppercase tracking-wider">
                              You
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Problems Solved */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                        {entry.problems_solved}
                      </td>

                      {/* Submissions count */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400 text-xs">
                        {entry.submissions_count || 0}
                      </td>

                      {/* Total Score */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                        {entry.total_score.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400">
            No rankings found on the leaderboard yet.
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            Showing <span className="text-white font-semibold">{startItem}</span> to{" "}
            <span className="text-white font-semibold">{endItem}</span> of{" "}
            <span className="text-white font-semibold">{total}</span> competitors
          </div>

          <div className="flex items-center space-x-1.5">
            {/* First Page */}
            <button
              disabled={page === 0 || loading || isPaginating}
              onClick={() => handlePageChange(0)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="First Page"
            >
              «
            </button>

            {/* Prev Page */}
            <button
              disabled={page === 0 || loading || isPaginating}
              onClick={() => handlePageChange(page - 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-800/80 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>

            {/* Numeric Page Buttons */}
            <div className="hidden sm:flex items-center space-x-1">
              {getPageNumbers().map((item, idx) => {
                if (typeof item === "string") {
                  return (
                    <span key={`${item}-${idx}`} className="px-2 py-1 text-slate-500">
                      …
                    </span>
                  );
                }
                const isActive = item === page;
                return (
                  <button
                    key={item}
                    disabled={loading || isPaginating}
                    onClick={() => handlePageChange(item)}
                    className={`min-w-8 h-8 px-2 rounded-lg font-medium text-xs transition-all ${
                      isActive
                        ? "bg-blue-600 text-white font-bold ring-2 ring-blue-400/40 shadow-sm"
                        : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/80"
                    }`}
                  >
                    {item + 1}
                  </button>
                );
              })}
            </div>

            {/* Next Page */}
            <button
              disabled={page >= totalPages - 1 || loading || isPaginating}
              onClick={() => handlePageChange(page + 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-800/80 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>

            {/* Last Page */}
            <button
              disabled={page >= totalPages - 1 || loading || isPaginating}
              onClick={() => handlePageChange(totalPages - 1)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Last Page"
            >
              »
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
