"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const emptySubscribe = () => () => {};

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function formatPenalty(seconds) {
  if (!seconds || seconds <= 0) return "0s";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function getTimeRemaining(targetDate) {
  if (!targetDate) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const targetTime = new Date(targetDate).getTime();
  if (isNaN(targetTime)) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const diff = Math.max(0, targetTime - Date.now());
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { total: diff, days, hours, minutes, seconds };
}

export default function ContestDetailPage() {
  const routeParams = useParams();
  const contestId = routeParams?.id;
  const router = useRouter();
  const { user } = useAuth();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const [contest, setContest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("problems"); // problems, leaderboard, submissions

  // Sub-data states
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: "", type: "info" });

  // 1-second interval for countdown clock
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchContest = async () => {
    if (!contestId) return;
    try {
      const res = await api.get(`/api-v1/contests/${contestId}`);
      setContest(res);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to retrieve contest details.");
    } finally {
      setLoading(false);
    }
  };

  // fetchLeaderboard and fetchMySubmissions are handled by the tab-switching useEffect below.

  useEffect(() => {
    let isMounted = true;
    if (!contestId) return;

    api.get(`/api-v1/contests/${contestId}`)
      .then((res) => {
        if (isMounted) {
          setContest(res);
          setError("");
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to retrieve contest details.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [contestId]);

  useEffect(() => {
    let isMounted = true;
    if (!contestId) return;

    if (activeTab === "leaderboard") {
      api.get(`/api-v1/contests/${contestId}/leaderboard?limit=100`)
        .then((res) => {
          if (isMounted) {
            setLeaderboardData(res);
            setLeaderboardLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) setLeaderboardLoading(false);
        });
    } else if (activeTab === "submissions" && user) {
      api.get(`/api-v1/contests/${contestId}/my-submissions?limit=50`)
        .then((res) => {
          if (isMounted) {
            setMySubmissions(res?.submissions || []);
            setSubmissionsLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) setSubmissionsLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [activeTab, contestId, user]);

  const handleRegister = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/api-v1/contests/${contestId}/register`);
      setFeedback({
        message: "You are now registered for this contest! Good luck.",
        type: "success",
      });
      fetchContest();
    } catch (err) {
      setFeedback({ message: err.message || "Failed to register.", type: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnregister = async () => {
    if (!confirm("Are you sure you want to unregister from this contest?")) return;
    setActionLoading(true);
    try {
      await api.delete(`/api-v1/contests/${contestId}/register`);
      setFeedback({
        message: "Successfully unregistered from contest.",
        type: "info",
      });
      fetchContest();
    } catch (err) {
      setFeedback({ message: err.message || "Failed to unregister.", type: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <span className="text-xs font-mono text-slate-400">Loading contest hub...</span>
        </div>
      </div>
    );
  }

  if (error || !contest) {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl bg-[#0a0d14] border border-white/[0.08] p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-white mb-1">Contest Not Available</h2>
          <p className="text-xs text-slate-400 mb-6">{error || "This contest could not be found."}</p>
          <Link
            href="/contests"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            ← Back to All Contests
          </Link>
        </div>
      </div>
    );
  }

  const isActive = contest.status === "active";
  const isUpcoming = contest.status === "upcoming";
  const isCompleted = contest.status === "completed";

  const targetCountdownDate = isActive ? contest.end_time : contest.start_time;
  const countdown = mounted ? getTimeRemaining(targetCountdownDate) : { days: 0, hours: 0, minutes: 0, seconds: 0 };

  const alphabetIndex = (idx) => String.fromCharCode(65 + idx);

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

  const statusBadge = (st) => {
    switch (st?.toLowerCase()) {
      case "accepted":
        return "text-emerald-400 bg-emerald-950/60 border-emerald-600/40";
      case "wrong_answer":
        return "text-rose-400 bg-rose-950/60 border-rose-600/40";
      case "time_limit_exceeded":
        return "text-amber-400 bg-amber-950/60 border-amber-600/40";
      default:
        return "text-slate-400 bg-slate-900/60 border-slate-700/40";
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Top Navigation Breadcrumbs */}
        <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
          <Link href="/contests" className="hover:text-white transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Contests
          </Link>
          <span className="font-mono text-slate-500">ID: {contest.id.slice(0, 8)}</span>
        </div>

        {/* Feedback Alert */}
        {feedback.message && (
          <div
            className={`mb-6 p-4 rounded-xl text-xs flex items-center justify-between animate-fadeIn ${
              feedback.type === "success"
                ? "bg-emerald-950/40 border border-emerald-500/40 text-emerald-200"
                : feedback.type === "error"
                ? "bg-rose-950/40 border border-rose-500/40 text-rose-200"
                : "bg-indigo-950/40 border border-indigo-500/40 text-indigo-200"
            }`}
          >
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback({ message: "", type: "info" })} className="font-bold ml-4">✕</button>
          </div>
        )}

        {/* Hero Card & Countdown Banner */}
        <div className="rounded-2xl bg-[#0a0d14] border border-white/[0.08] p-6 sm:p-8 mb-6 relative overflow-hidden shadow-xl shadow-black/40">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-3">
                {isActive ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE CONTEST IN PROGRESS
                  </span>
                ) : isUpcoming ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-950/80 text-indigo-400 border border-indigo-500/40">
                    UPCOMING CONTEST
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-900 text-slate-400 border border-slate-700/60">
                    COMPLETED CONTEST
                  </span>
                )}

                {contest.is_registered && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ✓ Registered Participant
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {contest.title}
              </h1>

              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                {contest.description || "Welcome to the contest! Test your algorithms, data structures, and optimization skills under time pressure."}
              </p>

              {/* Contest Rules & Metadata bar */}
              <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Duration:</span>
                  <span className="font-semibold text-slate-200">{formatDuration(contest.duration_seconds)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Wrong Attempt Penalty:</span>
                  <span className="font-semibold text-slate-200">{contest.penalty_minutes} min</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Participants:</span>
                  <span className="font-semibold text-slate-200">{contest.participant_count}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Problems:</span>
                  <span className="font-semibold text-slate-200">{contest.problem_count}</span>
                </div>
              </div>
            </div>

            {/* Live Visual Countdown Box */}
            <div className="rounded-2xl bg-black/40 border border-white/[0.08] p-5 shrink-0 flex flex-col items-center justify-center min-w-[260px] text-center">
              <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400 mb-2">
                {isActive ? "Contest Closes In" : isUpcoming ? "Contest Starts In" : "Contest Concluded"}
              </span>

              {isCompleted ? (
                <div className="py-2">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-2">
                    🏆
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Final Results Verified</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 font-mono">
                  {countdown.days > 0 && (
                    <div className="flex flex-col items-center">
                      <span className="text-xl sm:text-2xl font-bold text-white bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.06]">
                        {String(countdown.days).padStart(2, "0")}
                      </span>
                      <span className="text-[9px] text-slate-500 uppercase mt-1">Days</span>
                    </div>
                  )}
                  <div className="flex flex-col items-center">
                    <span className="text-xl sm:text-2xl font-bold text-white bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.06]">
                      {String(countdown.hours).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase mt-1">Hours</span>
                  </div>
                  <span className="text-slate-600 font-bold mb-3">:</span>
                  <div className="flex flex-col items-center">
                    <span className="text-xl sm:text-2xl font-bold text-white bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.06]">
                      {String(countdown.minutes).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase mt-1">Mins</span>
                  </div>
                  <span className="text-slate-600 font-bold mb-3">:</span>
                  <div className="flex flex-col items-center">
                    <span className="text-xl sm:text-2xl font-bold text-emerald-400 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.06]">
                      {String(countdown.seconds).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase mt-1">Secs</span>
                  </div>
                </div>
              )}

              {/* Action Button inside Card */}
              <div className="mt-4 w-full">
                {!user ? (
                  <Link
                    href="/login"
                    className="w-full block py-2 px-4 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                  >
                    Log In to Participate
                  </Link>
                ) : isUpcoming ? (
                  contest.is_registered ? (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleUnregister}
                      className="w-full py-2 px-4 rounded-xl text-xs font-semibold bg-white/[0.06] hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-800/40 text-slate-300 border border-white/[0.08] transition-all disabled:opacity-50"
                    >
                      {actionLoading ? "Processing..." : "Unregister"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleRegister}
                      className="w-full py-2 px-4 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50"
                    >
                      {actionLoading ? "Registering..." : "Register Now"}
                    </button>
                  )
                ) : isActive ? (
                  !contest.is_registered ? (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleRegister}
                      className="w-full py-2 px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/30 disabled:opacity-50"
                    >
                      {actionLoading ? "Joining..." : "Join Contest & Solve"}
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-400 font-semibold block">
                      ✓ Active Participation
                    </span>
                  )
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Winner Announcement Trophy Card (when completed) */}
        {isCompleted && leaderboardData?.winner && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-indigo-950/40 border border-amber-500/30 p-5 sm:p-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-2xl shrink-0">
                🥇
              </div>
              <div>
                <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                  Contest Champion
                </span>
                <h2 className="text-lg font-extrabold text-white">
                  {leaderboardData.winner.username}
                </h2>
                <p className="text-xs text-slate-400">
                  Secured 1st place with {leaderboardData.winner.score} pts ({leaderboardData.winner.problems_solved} problems solved, penalty {formatPenalty(leaderboardData.winner.penalty_seconds)}).
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("leaderboard")}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors shrink-0"
            >
              View Full Standings
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mb-6 flex items-center gap-2 border-b border-white/[0.08] pb-3">
          {[
            { id: "problems", label: "Problems", count: contest.problem_count },
            { id: "leaderboard", label: "Leaderboard", count: contest.participant_count },
            { id: "submissions", label: "My Submissions", count: mySubmissions.length },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                    activeTab === tab.id ? "bg-white/20 text-white" : "bg-white/[0.06] text-slate-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* TAB 1: Problems */}
        {activeTab === "problems" && (
          <div>
            {isUpcoming ? (
              <div className="rounded-2xl bg-[#0a0d14] border border-white/[0.08] p-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-white mb-1">Problems Are Locked</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                  Contest problems and problem statements will become accessible as soon as the countdown reaches zero. Make sure you are registered!
                </p>
                {!contest.is_registered && (
                  <button
                    onClick={handleRegister}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                  >
                    Register for Contest
                  </button>
                )}
              </div>
            ) : (!contest.problems || contest.problems.length === 0) ? (
              <div className="rounded-2xl bg-[#0a0d14] border border-white/[0.08] p-12 text-center text-slate-400 text-xs">
                No problems configured for this contest yet.
              </div>
            ) : (
              <div className="space-y-3">
                {contest.problems.map((prob, idx) => (
                  <div
                    key={prob.id}
                    className="rounded-2xl bg-[#0a0d14] border border-white/[0.08] hover:border-white/[0.14] p-4 sm:p-5 flex items-center justify-between gap-4 transition-all"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] text-slate-200 font-mono font-bold flex items-center justify-center text-sm">
                        {alphabetIndex(idx)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white hover:text-indigo-400 transition-colors">
                            <Link href={`/contests/${contest.id}/problems/${prob.problem_id}`}>
                              {prob.title}
                            </Link>
                          </h3>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase ${difficultyBadge(
                              prob.difficulty
                            )}`}
                          >
                            {prob.difficulty}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">
                          Allocated: <strong className="text-slate-200">{prob.points} Points</strong>
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/contests/${contest.id}/problems/${prob.problem_id}`}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600/90 hover:bg-indigo-600 text-white transition-all shadow-sm shadow-indigo-600/20 shrink-0"
                    >
                      {isActive ? "Solve Problem →" : "View Problem →"}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Leaderboard */}
        {activeTab === "leaderboard" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-slate-400">
                Ranked by Score (desc), Solved (desc), Penalty Time (asc).
              </span>
              <button
                onClick={fetchLeaderboard}
                disabled={leaderboardLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/[0.08] hover:bg-white/[0.04] text-slate-300 transition-colors flex items-center gap-1.5"
              >
                <svg className={`w-3.5 h-3.5 ${leaderboardLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Board
              </button>
            </div>

            {leaderboardLoading && !leaderboardData ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">
                Calculating live rankings...
              </div>
            ) : leaderboardData?.leaderboard?.length === 0 ? (
              <div className="rounded-2xl bg-[#0a0d14] border border-white/[0.08] p-12 text-center text-xs text-slate-400">
                No submissions recorded yet for this contest. Be the first to solve a problem!
              </div>
            ) : (
              <div className="rounded-2xl bg-[#0a0d14] border border-white/[0.08] overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.08] bg-[#07090e]/60 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                        <th className="py-3 px-4 w-14 text-center">Rank</th>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4 text-right">Score</th>
                        <th className="py-3 px-4 text-center">Solved</th>
                        <th className="py-3 px-4 text-right">Penalty</th>
                        {contest.problems?.map((p, idx) => (
                          <th key={p.id} className="py-3 px-3 text-center w-16">
                            {alphabetIndex(idx)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {leaderboardData?.leaderboard?.map((entry) => {
                        const isMe = user?.id === entry.user_id;
                        return (
                          <tr
                            key={entry.user_id}
                            className={`transition-colors ${
                              isMe ? "bg-indigo-950/30 text-white" : "hover:bg-white/[0.02] text-slate-300"
                            }`}
                          >
                            <td className="py-3.5 px-4 text-center font-bold">
                              {entry.rank === 1 ? (
                                <span className="text-amber-400">🥇 1</span>
                              ) : entry.rank === 2 ? (
                                <span className="text-slate-300">🥈 2</span>
                              ) : entry.rank === 3 ? (
                                <span className="text-amber-600">🥉 3</span>
                              ) : (
                                <span className="text-slate-500 font-mono">{entry.rank}</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                              <span>{entry.username}</span>
                              {isMe && (
                                <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded">
                                  You
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-300">
                              {entry.score}
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono">
                              {entry.problems_solved} / {contest.problem_count}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                              {formatPenalty(entry.penalty_seconds)}
                            </td>
                            {contest.problems?.map((p) => {
                              const pStat = entry.problem_scores?.[String(p.problem_id)];
                              if (!pStat) {
                                return <td key={p.id} className="py-3.5 px-3 text-center text-slate-600 font-mono">-</td>;
                              }
                              return (
                                <td key={p.id} className="py-3.5 px-3 text-center font-mono">
                                  {pStat.is_solved ? (
                                    <span className="text-emerald-400 font-bold block" title={`Solved in ${formatPenalty(pStat.solved_time_seconds)}`}>
                                      +{pStat.score}
                                    </span>
                                  ) : pStat.attempts > 0 ? (
                                    <span className="text-rose-400 text-[11px] block">
                                      -{pStat.attempts}
                                    </span>
                                  ) : (
                                    <span className="text-slate-600">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: My Submissions */}
        {activeTab === "submissions" && (
          <div>
            {!user ? (
              <div className="rounded-2xl bg-[#0a0d14] border border-white/[0.08] p-12 text-center text-xs text-slate-400">
                Please log in to view your submission history.
              </div>
            ) : submissionsLoading ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">
                Loading submissions...
              </div>
            ) : mySubmissions.length === 0 ? (
              <div className="rounded-2xl bg-[#0a0d14] border border-white/[0.08] p-12 text-center text-xs text-slate-400">
                You haven&apos;t submitted any code to this contest yet.
              </div>
            ) : (
              <div className="rounded-2xl bg-[#0a0d14] border border-white/[0.08] overflow-hidden shadow-xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-[#07090e]/60 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                      <th className="py-3 px-4">Problem</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Score</th>
                      <th className="py-3 px-4 text-center">Tests Passed</th>
                      <th className="py-3 px-4 text-center">Language</th>
                      <th className="py-3 px-4 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {mySubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-white/[0.02] text-slate-300">
                        <td className="py-3 px-4 font-medium text-white">
                          {sub.problem_name || `Problem #${sub.problem_id}`}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadge(sub.status)}`}>
                            {sub.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-indigo-300">
                          {sub.score} / {sub.max_score}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {sub.tests_passed} / {sub.total_tests}
                        </td>
                        <td className="py-3 px-4 text-center uppercase font-mono text-[11px] text-slate-400">
                          {sub.language}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500 text-[11px]">
                          {new Date(sub.created_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
