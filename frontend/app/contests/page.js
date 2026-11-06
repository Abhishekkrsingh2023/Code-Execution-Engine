"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const PAGE_SIZE = 12;
const emptySubscribe = () => () => {};

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function formatCountdown(targetDate, prefix = "") {
  if (!targetDate) return "0s";
  const targetTime = new Date(targetDate).getTime();
  if (isNaN(targetTime)) return "0s";
  const diff = Math.max(0, targetTime - Date.now());
  if (diff <= 0) return "0s";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  if (days > 0) return `${prefix}${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${prefix}${hours}h ${minutes}m ${seconds}s`;
  return `${prefix}${minutes}m ${seconds}s`;
}

export default function ContestsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const [contests, setContests] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState("all"); // all, active, upcoming, completed
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // Re-render countdowns every second
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchContests = () => {
    const params = new URLSearchParams();
    params.set("skip", page * PAGE_SIZE);
    params.set("limit", PAGE_SIZE);
    if (activeTab !== "all") params.set("status", activeTab);
    if (search.trim()) params.set("search", search.trim());

    setLoading(true);
    api.get(`/api-v1/contests?${params.toString()}`)
      .then((res) => {
        setContests(res?.contests || []);
        setTotal(res?.total || 0);
        setError("");
      })
      .catch((err) => {
        setError(err.message || "Failed to retrieve contest list.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let isMounted = true;
    const params = new URLSearchParams();
    params.set("skip", page * PAGE_SIZE);
    params.set("limit", PAGE_SIZE);
    if (activeTab !== "all") params.set("status", activeTab);
    if (search.trim()) params.set("search", search.trim());

    api.get(`/api-v1/contests?${params.toString()}`)
      .then((res) => {
        if (isMounted) {
          setContests(res?.contests || []);
          setTotal(res?.total || 0);
          setError("");
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to retrieve contest list.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [page, activeTab, search]);

  const handleRegister = async (contestId, e) => {
    e.preventDefault();
    if (!user) {
      router.push("/login");
      return;
    }
    setActionLoadingId(contestId);
    setFeedbackMsg("");
    try {
      await api.post(`/api-v1/contests/${contestId}/register`);
      setFeedbackMsg("Registered successfully! Welcome to the contest.");
      setTimeout(() => setFeedbackMsg(""), 4000);
      fetchContests();
    } catch (err) {
      alert(err.message || "Failed to register for contest.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const contestList = Array.isArray(contests) ? contests : [];

  // Active / Upcoming / Completed Counts for summary badges
  const activeCount = contestList.filter((c) => c.status === "active").length;
  const upcomingCount = contestList.filter((c) => c.status === "upcoming").length;

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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Header & Hero */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.06] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Competitive Arena
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Contests & Tournaments
            </h1>
            <p className="mt-1 text-sm text-slate-400 max-w-2xl">
              Compete against other engineers in real-time coding challenges, solve problems under time pressure, and rise up the leaderboards.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{activeCount} Active Now</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
              <span>{upcomingCount} Upcoming</span>
            </div>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedbackMsg && (
          <div className="mb-6 p-3.5 rounded-xl bg-emerald-900/30 border border-emerald-500/40 text-emerald-200 text-sm flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{feedbackMsg}</span>
            </div>
            <button onClick={() => setFeedbackMsg("")} className="text-emerald-400 hover:text-white text-xs">✕</button>
          </div>
        )}

        {/* Filters & Search Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0a0d14] border border-white/[0.08] overflow-x-auto">
            {[
              { id: "all", label: "All Contests" },
              { id: "active", label: "Active Now" },
              { id: "upcoming", label: "Upcoming" },
              { id: "completed", label: "Completed" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setPage(0);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(0);
              fetchContests();
            }}
            className="relative sm:w-72"
          >
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contests..."
              className="w-full bg-[#0a0d14] border border-white/[0.08] rounded-xl px-3.5 py-1.5 pl-9 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <svg
              className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(0);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </form>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-2xl bg-[#0a0d14]/70 border border-white/[0.06] p-5 animate-pulse flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="h-5 bg-white/[0.05] rounded-lg w-1/3" />
                  <div className="h-6 bg-white/[0.08] rounded-lg w-3/4" />
                  <div className="h-10 bg-white/[0.04] rounded-lg w-full" />
                </div>
                <div className="h-10 bg-white/[0.06] rounded-xl w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-rose-950/20 border border-rose-800/30 p-8 text-center">
            <svg className="w-8 h-8 text-rose-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-base font-semibold text-rose-200">Unable to load contests</h3>
            <p className="mt-1 text-xs text-rose-300/80 max-w-md mx-auto">{error}</p>
            <button
              onClick={fetchContests}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors"
            >
              Retry
            </button>
          </div>
        ) : contests.length === 0 ? (
          <div className="rounded-2xl bg-[#0a0d14]/70 border border-white/[0.06] p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-3 text-slate-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-200">No contests found</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              {search || activeTab !== "all"
                ? "Try clearing search filters to see all available competitions."
                : "No contests are scheduled at this time. Check back soon!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {contestList.map((contest) => {
              const isActive = contest.status === "active";
              const isUpcoming = contest.status === "upcoming";
              const isCompleted = contest.status === "completed";

              const startDate = new Date(contest.start_time);
              const endDate = new Date(contest.end_time);

              return (
                <div
                  key={contest.id}
                  className={`group relative rounded-2xl bg-[#0a0d14] border transition-all duration-200 flex flex-col justify-between overflow-hidden hover:shadow-xl hover:shadow-black/50 ${
                    isActive
                      ? "border-emerald-500/40 hover:border-emerald-500/60"
                      : isUpcoming
                      ? "border-indigo-500/30 hover:border-indigo-500/50"
                      : "border-white/[0.08] hover:border-white/[0.14]"
                  }`}
                >
                  {/* Status Banner */}
                  <div className="p-5 pb-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          LIVE NOW
                        </span>
                      ) : isUpcoming ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-950/60 text-indigo-400 border border-indigo-500/30">
                          UPCOMING
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-900/80 text-slate-400 border border-slate-700/40">
                          COMPLETED
                        </span>
                      )}

                      {/* Registration Badge */}
                      {contest.is_registered && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Registered
                        </span>
                      )}
                    </div>

                    <h2 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                      <Link href={`/contests/${contest.id}`}>
                        {contest.title}
                      </Link>
                    </h2>

                    <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {contest.description || "Compete in this problem-solving tournament to earn points and climb the rankings."}
                    </p>

                    {/* Countdown or Schedule Highlight */}
                    <div className="mt-4 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between text-xs">
                      {isActive && (
                        <div className="flex items-center gap-2 text-emerald-300 font-mono">
                          <svg className="w-4 h-4 text-emerald-400 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{mounted ? formatCountdown(contest.end_time, "Ends in: ") : "In Progress"}</span>
                        </div>
                      )}
                      {isUpcoming && (
                        <div className="flex items-center gap-2 text-indigo-300 font-mono">
                          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{mounted ? formatCountdown(contest.start_time, "Starts in: ") : "Upcoming"}</span>
                        </div>
                      )}
                      {isCompleted && (
                        <span className="text-slate-400 text-xs">
                          Ended {endDate.toLocaleDateString()}
                        </span>
                      )}

                      <span className="text-[11px] text-slate-500">
                        {formatDuration(contest.duration_seconds)}
                      </span>
                    </div>

                    {/* Metadata Badges */}
                    <div className="mt-3.5 flex items-center gap-3 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span>{contest.problem_count} Problems</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span>{contest.participant_count} Participants</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="p-4 pt-3 border-t border-white/[0.06] bg-[#07090e]/60 flex items-center justify-between gap-2">
                    <Link
                      href={`/contests/${contest.id}`}
                      className="text-xs text-slate-400 hover:text-white font-medium transition-colors"
                    >
                      Details & Rules →
                    </Link>

                    {isActive ? (
                      <Link
                        href={`/contests/${contest.id}`}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20"
                      >
                        {contest.is_registered ? "Enter Contest" : "Join & Solve"}
                      </Link>
                    ) : isUpcoming ? (
                      contest.is_registered ? (
                        <Link
                          href={`/contests/${contest.id}`}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.12] text-slate-200 transition-colors"
                        >
                          View Hub
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled={actionLoadingId === contest.id}
                          onClick={(e) => handleRegister(contest.id, e)}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
                        >
                          {actionLoadingId === contest.id ? "Registering..." : "Register Now"}
                        </button>
                      )
                    ) : (
                      <Link
                        href={`/contests/${contest.id}`}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 transition-colors"
                      >
                        Results & Board
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs text-slate-400">
            <span>
              Showing {page * PAGE_SIZE + 1} to {Math.min((page + 1) * PAGE_SIZE, total)} of {total} contests
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="font-mono px-2">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
