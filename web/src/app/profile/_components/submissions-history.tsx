"use client";

import { useState } from "react";
import Link from "next/link";
import type { UserSubmissionItem } from "@/types/execution";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Code2,
  Copy,
  Check,
  X,
  FileCode,
  ExternalLink,
  Layers,
} from "lucide-react";

interface SubmissionsHistoryProps {
  initialSubmissions: UserSubmissionItem[];
  total: number;
}

export function SubmissionsHistory({ initialSubmissions, total }: SubmissionsHistoryProps) {
  const [selectedSubmission, setSelectedSubmission] = useState<UserSubmissionItem | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "accepted") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Accepted</span>
        </span>
      );
    }
    if (s === "wrong_answer") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
          <XCircle className="w-3.5 h-3.5" />
          <span>Wrong Answer</span>
        </span>
      );
    }
    if (s === "time_limit_exceeded" || s === "tle") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <Clock className="w-3.5 h-3.5" />
          <span>Time Limit Exceeded</span>
        </span>
      );
    }
    if (s === "compilation_error") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-orange-500/10 text-orange-500 border border-orange-500/20">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Compilation Error</span>
        </span>
      );
    }
    if (s === "memory_limit_exceeded") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-purple-500/10 text-purple-500 border border-purple-500/20">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Memory Limit Exceeded</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] capitalize">
        <Layers className="w-3.5 h-3.5" />
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
        return "C (GCC)";
      case "java":
        return "Java 21";
      case "javascript":
        return "JavaScript";
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
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  if (!initialSubmissions || initialSubmissions.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-[var(--muted)]/50 border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--muted-foreground)]">
          <FileCode className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-[var(--foreground)]">No submissions recorded yet</h3>
          <p className="text-xs text-[var(--muted-foreground)] max-w-sm mx-auto">
            Your official evaluation submissions will appear here once you submit code for any challenge.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/problems"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--brand)] text-[var(--brand-foreground)] text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <span>Explore Problems</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">
            Submission History
          </h2>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Showing {initialSubmissions.length} of {total} total submissions
          </p>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border)] bg-[var(--muted)]/50 text-[var(--muted-foreground)] uppercase tracking-wider font-medium text-[11px]">
              <tr>
                <th className="py-3 px-4">Problem</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4">Tests Passed</th>
                <th className="py-3 px-4">Language</th>
                <th className="py-3 px-4">Runtime</th>
                <th className="py-3 px-4">Submitted At</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {initialSubmissions.map((sub) => (
                <tr
                  key={sub.id}
                  className="hover:bg-[var(--muted)]/30 transition-colors cursor-pointer group"
                  onClick={() => setSelectedSubmission(sub)}
                >
                  <td className="py-3.5 px-4">
                    {sub.problem_id ? (
                      <Link
                        href={`/problems/${sub.problem_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-[var(--foreground)] hover:text-[var(--brand)] transition-colors inline-flex items-center gap-1.5"
                      >
                        <span>#{sub.problem_id}</span>
                        <span>{sub.problem_name || "Problem"}</span>
                      </Link>
                    ) : (
                      <span className="font-medium text-[var(--foreground)]">
                        {sub.problem_name || "Problem"}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">{getStatusBadge(sub.status)}</td>
                  <td className="py-3.5 px-4 font-mono font-medium text-[var(--foreground)]">
                    {sub.score.toFixed(1)} / {sub.max_score.toFixed(1)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[var(--muted-foreground)]">
                    {sub.tests_passed} / {sub.total_tests}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[var(--muted-foreground)]">
                    <span className="px-2 py-0.5 rounded bg-[var(--muted)]/80 border border-[var(--border)] text-[11px]">
                      {formatLanguage(sub.language)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[var(--muted-foreground)]">
                    {sub.execution_time !== null && sub.execution_time !== undefined
                      ? `${sub.execution_time.toFixed(2)}s`
                      : "—"}
                  </td>
                  <td className="py-3.5 px-4 text-[var(--muted-foreground)] whitespace-nowrap">
                    {formatDate(sub.created_at)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSubmission(sub);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border border-[var(--border)] hover:bg-[var(--muted)] text-[var(--foreground)] transition-colors"
                    >
                      <Code2 className="w-3.5 h-3.5 text-[var(--brand)]" />
                      <span>Code</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Code Inspection Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-2xl max-h-[85vh] rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--muted)]/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[var(--foreground)]">
                    {selectedSubmission.problem_name || `Problem #${selectedSubmission.problem_id}`}
                  </h3>
                  {getStatusBadge(selectedSubmission.status)}
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)] font-mono">
                  <span>Language: {formatLanguage(selectedSubmission.language)}</span>
                  <span>•</span>
                  <span>
                    Score: {selectedSubmission.score}/{selectedSubmission.max_score}
                  </span>
                  <span>•</span>
                  <span>
                    Tests: {selectedSubmission.tests_passed}/{selectedSubmission.total_tests}
                  </span>
                  {selectedSubmission.execution_time !== null && (
                    <>
                      <span>•</span>
                      <span>Runtime: {selectedSubmission.execution_time.toFixed(2)}s</span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="p-1.5 rounded-md hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Code Body */}
            <div className="flex-1 overflow-y-auto p-4 bg-[var(--background)]">
              <div className="relative">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border)]">
                  <span className="text-[11px] font-mono text-[var(--muted-foreground)] uppercase">
                    Submitted Source Code
                  </span>
                  {selectedSubmission.source_code && (
                    <button
                      type="button"
                      onClick={() => handleCopyCode(selectedSubmission.source_code || "")}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-500">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {selectedSubmission.source_code ? (
                  <pre className="font-mono text-xs leading-relaxed p-4 rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] overflow-x-auto whitespace-pre">
                    <code>{selectedSubmission.source_code}</code>
                  </pre>
                ) : (
                  <p className="text-xs text-[var(--muted-foreground)] italic py-6 text-center">
                    No source code archived for this submission record.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] bg-[var(--card)]">
              <span className="text-xs text-[var(--muted-foreground)]">
                Submitted on {formatDate(selectedSubmission.created_at)}
              </span>
              <div className="flex items-center gap-2">
                {selectedSubmission.problem_id && (
                  <Link
                    href={`/problems/${selectedSubmission.problem_id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-[var(--brand)] text-[var(--brand-foreground)] hover:opacity-90 transition-opacity"
                  >
                    <span>Go to Problem</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedSubmission(null)}
                  className="px-3 py-1.5 rounded text-xs font-medium border border-[var(--border)] hover:bg-[var(--muted)] text-[var(--foreground)] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

