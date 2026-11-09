"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { UserResponse } from "@/types/user";
import type { UserSubmissionItem, SupportedLanguage } from "@/types/execution";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Code2,
  Copy,
  Check,
  RotateCcw,
  LogIn,
  Loader2,
  FileCode,
  Layers,
} from "lucide-react";

interface ProblemSubmissionsProps {
  problemId: number;
  user: UserResponse | null;
  refreshTrigger?: number;
  onLoadCode?: (code: string, language: SupportedLanguage) => void;
}

export function ProblemSubmissions({
  problemId,
  user,
  refreshTrigger = 0,
  onLoadCode,
}: ProblemSubmissionsProps) {
  const [submissions, setSubmissions] = useState<UserSubmissionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(user));
  const [error, setError] = useState<string | null>(null);
  const [manualRefreshCount, setManualRefreshCount] = useState<number>(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    if (!user) {
      return;
    }

    const load = async () => {
      try {
        const res = await fetch(`/api/submissions?problem_id=${problemId}&limit=50`);
        if (isCancelled) return;
        if (res.status === 401) {
          setError("Please log in to view your submission history.");
          return;
        }
        if (!res.ok) {
          setError("Failed to load submissions.");
          return;
        }
        const data = await res.json();
        if (!isCancelled) {
          setSubmissions(data.submissions || []);
        }
      } catch {
        if (!isCancelled) {
          setError("Network error while loading submissions.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      isCancelled = true;
    };
  }, [problemId, user, refreshTrigger, manualRefreshCount]);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setError(null);
    setManualRefreshCount((prev) => prev + 1);
  }, []);

  const handleCopyCode = async (subId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(subId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "accepted") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" />
          <span>Accepted</span>
        </span>
      );
    }
    if (s === "wrong_answer") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
          <XCircle className="w-3 h-3" />
          <span>Wrong Answer</span>
        </span>
      );
    }
    if (s === "time_limit_exceeded" || s === "tle") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <Clock className="w-3 h-3" />
          <span>Time Limit Exceeded</span>
        </span>
      );
    }
    if (s === "compilation_error") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-500/10 text-orange-500 border border-orange-500/20">
          <AlertTriangle className="w-3 h-3" />
          <span>Compilation Error</span>
        </span>
      );
    }
    if (s === "memory_limit_exceeded") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/10 text-purple-500 border border-purple-500/20">
          <AlertTriangle className="w-3 h-3" />
          <span>Memory Limit Exceeded</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] capitalize">
        <Layers className="w-3 h-3" />
        <span>{status.replace(/_/g, " ")}</span>
      </span>
    );
  };

  const formatLanguage = (lang: string) => {
    const l = lang.toLowerCase();
    switch (l) {
      case "python":
        return "Python 3";
      case "cpp":
        return "C++ 17";
      case "c":
        return "C";
      case "java":
        return "Java";
      default:
        return lang.toUpperCase();
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  if (!user) {
    return (
      <div className="h-full overflow-y-auto p-6 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-[var(--muted)]/50 border border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)]">
          <LogIn className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-xs">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Log in to view submissions</h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            Sign in to track your past submissions, scores, and execution records for this problem.
          </p>
        </div>
        <Link
          href={`/login?next=/problems/${problemId}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--brand)] text-[var(--brand-foreground)] text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Log In</span>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-[var(--muted-foreground)] text-xs gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-[var(--brand)]" />
        <span>Loading past submissions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full p-6 flex flex-col items-center justify-center text-center space-y-3">
        <AlertTriangle className="w-6 h-6 text-rose-500" />
        <p className="text-xs text-[var(--foreground)]">{error}</p>
        <button
          type="button"
          onClick={handleRefresh}
          className="px-3 py-1.5 rounded text-xs font-medium border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="h-full overflow-y-auto p-6 flex flex-col items-center justify-center text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-[var(--muted)]/50 border border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)]">
          <FileCode className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-xs">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">No submissions yet</h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            When you click <strong className="text-[var(--foreground)]">Submit</strong>, your official code evaluation will be recorded here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)] text-[var(--muted-foreground)] text-[11px]">
        <span>{submissions.length} Submissions</span>
        <button
          type="button"
          onClick={handleRefresh}
          className="hover:text-[var(--foreground)] transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-2">
        {submissions.map((sub) => {
          const isExpanded = expandedId === sub.id;
          const isCopied = copiedId === sub.id;

          return (
            <div
              key={sub.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden transition-all"
            >
              <div
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-[var(--muted)]/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : sub.id)}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(sub.status)}
                    <span className="font-mono text-[11px] font-semibold text-[var(--foreground)]">
                      {sub.score.toFixed(1)} / {sub.max_score.toFixed(1)} pts
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)] font-mono">
                    <span>{formatLanguage(sub.language)}</span>
                    <span>•</span>
                    <span>
                      {sub.tests_passed}/{sub.total_tests} passed
                    </span>
                    {sub.execution_time !== null && sub.execution_time !== undefined && (
                      <>
                        <span>•</span>
                        <span>{sub.execution_time.toFixed(2)}s</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-[10px] text-[var(--muted-foreground)] whitespace-nowrap">
                    {formatDate(sub.created_at)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(isExpanded ? null : sub.id);
                    }}
                    className="text-[11px] font-medium text-[var(--brand)] hover:underline inline-flex items-center gap-1"
                  >
                    <Code2 className="w-3 h-3" />
                    <span>{isExpanded ? "Hide Code" : "View Code"}</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Source Code View */}
              {isExpanded && (
                <div className="border-t border-[var(--border)] bg-[var(--background)] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-[var(--muted-foreground)]">
                      Submitted Code ({formatLanguage(sub.language)})
                    </span>
                    <div className="flex items-center gap-1.5">
                      {sub.source_code && onLoadCode && (
                        <button
                          type="button"
                          onClick={() => {
                            const lang = (sub.language.toLowerCase() as SupportedLanguage) || "python";
                            onLoadCode(sub.source_code || "", lang);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] transition-colors"
                          title="Load this submission into the editor"
                        >
                          <RotateCcw className="w-3 h-3 text-[var(--brand)]" />
                          <span>Load in Editor</span>
                        </button>
                      )}
                      {sub.source_code && (
                        <button
                          type="button"
                          onClick={() => handleCopyCode(sub.id, sub.source_code || "")}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] transition-colors"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-500">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {sub.source_code ? (
                    <pre className="font-mono text-[11px] leading-relaxed p-3 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] overflow-x-auto max-h-64 whitespace-pre">
                      <code>{sub.source_code}</code>
                    </pre>
                  ) : (
                    <p className="text-[11px] text-[var(--muted-foreground)] italic py-2">
                      Source code not stored for this submission.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
