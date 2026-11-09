"use client";

import type { SubmissionPollResponse, TestCaseVerdict } from "@/types/execution";
import { CheckCircle2, XCircle, AlertTriangle, Clock, Loader2, Info } from "lucide-react";

interface ResultPanelProps {
  result: SubmissionPollResponse | null;
  status: string; // "idle" | "queued" | "running" | "completed" | "failed" | "tle" | "compile_error"
  mode: "run" | "submit" | null;
}

export function ResultPanel({ result, status, mode }: ResultPanelProps) {
  if (status === "idle" || !result) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-xs text-[var(--muted-foreground)]">
        <Info className="w-6 h-6 mb-2 text-[var(--muted-foreground)]/60" />
        <p className="font-medium text-[var(--foreground)]">No execution results yet</p>
        <p className="mt-1 max-w-xs text-[11px]">
          Click <span className="font-semibold text-[var(--foreground)]">Run</span> to test against sample cases, or <span className="font-semibold text-[var(--brand)]">Submit</span> for official evaluation.
        </p>
      </div>
    );
  }

  if (status === "queued" || status === "running") {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-xs text-[var(--muted-foreground)]">
        <Loader2 className="w-6 h-6 mb-3 animate-spin text-[var(--brand)]" />
        <p className="font-medium text-[var(--foreground)]">
          {status === "queued" ? "Queued for execution..." : "Executing in isolated sandbox..."}
        </p>
        <p className="mt-1 text-[11px]">
          Evaluating code against test cases in container environment.
        </p>
      </div>
    );
  }

  // Parse results array if JSON string
  let parsedTestCases: TestCaseVerdict[] = [];
  if (result.results) {
    if (typeof result.results === "string") {
      try {
        parsedTestCases = JSON.parse(result.results);
      } catch {
        parsedTestCases = [];
      }
    } else if (Array.isArray(result.results)) {
      parsedTestCases = result.results;
    }
  }

  const rawStatus = (result.status || status).toLowerCase();
  const isAccepted = rawStatus === "completed" || rawStatus === "accepted";
  const isTLE = rawStatus === "tle";
  const isFailed = rawStatus === "failed" || rawStatus === "wrong_answer";
  const isCompileError = rawStatus === "compile_error";

  let verdictTitle = "Completed";
  let verdictColor = "text-[var(--foreground)]";
  let verdictIcon = <CheckCircle2 className="w-5 h-5 text-emerald-500" />;

  if (isAccepted) {
    verdictTitle = mode === "submit" ? "Accepted" : "Finished";
    verdictColor = "text-emerald-500";
    verdictIcon = <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
  } else if (isTLE) {
    verdictTitle = "Time Limit Exceeded";
    verdictColor = "text-amber-500";
    verdictIcon = <Clock className="w-5 h-5 text-amber-500" />;
  } else if (isCompileError) {
    verdictTitle = "Compilation Error";
    verdictColor = "text-rose-500";
    verdictIcon = <AlertTriangle className="w-5 h-5 text-rose-500" />;
  } else if (isFailed) {
    verdictTitle = mode === "submit" ? "Wrong Answer" : "Execution Failed";
    verdictColor = "text-rose-500";
    verdictIcon = <XCircle className="w-5 h-5 text-rose-500" />;
  }

  const runtimeMs = result.time_taken ? Math.round(result.time_taken * 1000) : null;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 text-xs font-sans">
      {/* Verdict Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2">
          {verdictIcon}
          <span className={`text-sm font-bold tracking-tight ${verdictColor}`}>
            {verdictTitle}
          </span>
          <span className="text-[11px] font-mono text-[var(--muted-foreground)] uppercase">
            ({mode})
          </span>
        </div>

        {/* High-level metrics */}
        <div className="flex items-center gap-4 text-xs font-mono text-[var(--muted-foreground)]">
          {runtimeMs !== null && (
            <span>Runtime: <strong className="text-[var(--foreground)]">{runtimeMs} ms</strong></span>
          )}
          {result.score !== undefined && result.max_score !== undefined && (
            <span>
              Score: <strong className="text-[var(--foreground)]">{result.score}/{result.max_score}</strong>
            </span>
          )}
          {result.tests_passed !== undefined && result.total_tests !== undefined && (
            <span>
              Passed: <strong className="text-[var(--foreground)]">{result.tests_passed}/{result.total_tests}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Compiler or Runtime Error output */}
      {result.error && (
        <div>
          <span className="text-[10px] uppercase font-sans font-medium text-rose-500 block mb-1">
            Error details (stderr):
          </span>
          <pre className="p-3 rounded-md border border-[var(--hard-border)] bg-[var(--hard-bg)] text-rose-400 font-mono text-xs whitespace-pre-wrap break-all overflow-x-auto">
            {result.error}
          </pre>
        </div>
      )}

      {/* Standard output if present */}
      {result.output && (
        <div>
          <span className="text-[10px] uppercase font-sans font-medium text-[var(--muted-foreground)] block mb-1">
            Standard Output (stdout):
          </span>
          <pre className="p-3 rounded-md border border-[var(--border)] bg-[var(--background)] font-mono text-xs whitespace-pre-wrap break-all overflow-x-auto">
            {result.output}
          </pre>
        </div>
      )}

      {/* Individual Test Cases Verdicts */}
      {parsedTestCases.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-sans font-medium text-[var(--muted-foreground)] block">
            Test Case Results:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {parsedTestCases.map((tc, idx) => {
              const tcPassed = tc.status === "passed";
              const tcTLE = tc.status === "tle";
              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-md border font-mono text-xs flex items-center justify-between ${
                    tcPassed
                      ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-500"
                      : tcTLE
                      ? "border-amber-500/20 bg-amber-500/5 text-amber-500"
                      : "border-rose-500/20 bg-rose-500/5 text-rose-500"
                  }`}
                >
                  <span className="font-medium">
                    Test #{tc.test_case ?? idx + 1}
                  </span>
                  <span className="uppercase text-[10px] font-bold">
                    {tc.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

