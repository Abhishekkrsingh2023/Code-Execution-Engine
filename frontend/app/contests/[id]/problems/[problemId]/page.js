"use client";

import { useEffect, useState, useRef, useCallback, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { useAuth } from "@/lib/AuthContext";
import ProblemMarkdown from "@/components/ProblemMarkdown";

const emptySubscribe = () => () => {};

// Dynamically import Monaco Editor with SSR disabled
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#0a0d14] flex flex-col items-center justify-center text-slate-500">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
      <span className="text-xs font-mono">Loading Monaco Editor...</span>
    </div>
  ),
});

const SUPPORTED_LANGS = [
  { id: "python", name: "Python 3", icon: "/languages/python.png", monacoLang: "python" },
  { id: "cpp", name: "C++", icon: "/languages/cpp.png", monacoLang: "cpp" },
  { id: "java", name: "Java", icon: "/languages/java.png", monacoLang: "java" },
  { id: "c", name: "C", icon: "/languages/c.png", monacoLang: "c" },
];

const DEFAULT_TEMPLATES = {
  python: `def solve():\n    # Read input from standard input\n    # Write your solution here\n    pass\n\nif __name__ == "__main__":\n    solve()\n`,
  cpp: `#include <iostream>\n#include <vector>\n#include <string>\n\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    // Write your solution here\n    return 0;\n}\n`,
  java: `import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        // Write your solution here\n    }\n}\n`,
  c: `#include <stdio.h>\n#include <stdlib.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n`,
};

function formatCountdown(targetDate) {
  const diff = Math.max(0, new Date(targetDate) - new Date());
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return {
    diff,
    text: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
    isUrgent: diff > 0 && diff < 10 * 60 * 1000,
  };
}

export default function ContestProblemPage() {
  const routeParams = useParams();
  const contestId = routeParams?.id;
  const problemId = routeParams?.problemId;
  const router = useRouter();
  const { user } = useAuth();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // Contest & problem metadata
  const [contest, setContest] = useState(null);
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Editor states
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(DEFAULT_TEMPLATES.python);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  // Execution states
  const [sampleCases, setSampleCases] = useState([]);
  const [executing, setExecuting] = useState(false);
  const [execStatus, setExecStatus] = useState("idle"); // idle, queued, running, completed, failed
  const [execResult, setExecResult] = useState(null);
  const [activeConsoleTab, setActiveConsoleTab] = useState("testcases"); // testcases, result, my-attempts
  const [myAttempts, setMyAttempts] = useState([]);
  const [selectedTestCaseIdx, setSelectedTestCaseIdx] = useState(0);

  const sseRef = useRef(null);
  const pollTimerRef = useRef(null);

  // Countdown timer ticker
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch contest and problem
  useEffect(() => {
    if (!contestId || !problemId) return;

    let ignore = false;
    async function loadData() {
      if (!/^\d+$/.test(String(problemId).trim())) {
        setError(`Invalid contest problem ID "${problemId}". Problem identifiers must be positive integers.`);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const [cRes, pRes] = await Promise.all([
          api.get(`/api-v1/contests/${contestId}`),
          api.get(`/api-v1/contests/${contestId}/problems/${problemId}`),
        ]);
        if (!ignore) {
          setContest(cRes);
          setProblem(pRes);
          setSampleCases(pRes.sample_test_cases || []);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to load contest problem.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, [contestId, problemId]);

  // Load past attempts for this problem in this contest
  const loadAttempts = useCallback(async () => {
    if (!contestId || !user) return;
    try {
      const res = await api.get(
        `/api-v1/contests/${contestId}/my-submissions?problem_id=${problemId}`
      );
      setMyAttempts(res?.submissions || []);
    } catch {
      // ignore
    }
  }, [contestId, problemId, user]);

  useEffect(() => {
    let isMounted = true;
    if (activeConsoleTab === "my-attempts" && contestId && user) {
      api.get(`/api-v1/contests/${contestId}/my-submissions?problem_id=${problemId}`)
        .then((res) => {
          if (isMounted) setMyAttempts(res?.submissions || []);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [activeConsoleTab, contestId, problemId, user]);

  // Cleanup SSE and polling on unmount
  useEffect(() => {
    return () => {
      if (sseRef.current) sseRef.current.close();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    setCode(DEFAULT_TEMPLATES[newLang] || "");
    setLangDropdownOpen(false);
  };

  const cleanupLiveExecution = () => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setExecuting(false);
  };

  const handleFinalResult = (result, mode) => {
    setExecStatus(result.status || "completed");
    setExecResult(result);
    setActiveConsoleTab("result");
    if (mode === "submit") {
      loadAttempts();
    }
  };

  const pollStatus = async (subId, mode) => {
    try {
      const res = await api.get(`/api-v1/code/submission/poll/${subId}`);
      if (res?.status && res.status !== "queued" && res.status !== "running") {
        handleFinalResult(res, mode);
        cleanupLiveExecution();
      }
    } catch {
      // ignore
    }
  };

  const connectSSE = (subId, mode) => {
    try {
      const sseUrl = `${API_URL}/api-v1/code/stream/${subId}`;
      const es = new EventSource(sseUrl, { withCredentials: true });
      sseRef.current = es;

      es.addEventListener("result", (event) => {
        try {
          const parsed = JSON.parse(event.data);
          handleFinalResult(parsed, mode);
          cleanupLiveExecution();
        } catch (e) {
          console.error("SSE parse error", e);
        }
      });

      es.onerror = () => {
        if (sseRef.current) {
          sseRef.current.close();
          sseRef.current = null;
        }
      };
    } catch {
      // fallback to polling
    }
  };

  const handleRunSampleCode = async () => {
    if (executing) return;
    setExecuting(true);
    setExecStatus("queued");
    setExecResult(null);
    setActiveConsoleTab("result");

    try {
      const testCases = sampleCases.map((sc, i) => ({
        id: i + 1,
        input: sc.input || "",
        expected_output: sc.expected_output || "",
        weight: 1.0,
      }));

      const payload = {
        problem_id: parseInt(problemId, 10),
        user_code: code,
        language,
        test_cases: testCases,
      };

      const res = await api.post(`/api-v1/contests/${contestId}/run`, payload);
      const subId = res.submission;

      connectSSE(subId, "run");
      pollTimerRef.current = setInterval(() => pollStatus(subId, "run"), 1400);
    } catch (err) {
      setExecStatus("failed");
      setExecResult({ error: err.message || "Failed to run test cases." });
      setExecuting(false);
    }
  };

  const handleSubmitContestSolution = async () => {
    if (executing) return;
    if (!user) {
      router.push("/login");
      return;
    }
    setExecuting(true);
    setExecStatus("queued");
    setExecResult(null);
    setActiveConsoleTab("result");

    try {
      const payload = {
        problem_id: parseInt(problemId, 10),
        user_code: code,
        language,
      };

      const res = await api.post(`/api-v1/contests/${contestId}/submit`, payload);
      const subId = res.submission;

      connectSSE(subId, "submit");
      pollTimerRef.current = setInterval(() => pollStatus(subId, "submit"), 1400);
    } catch (err) {
      setExecStatus("failed");
      setExecResult({ error: err.message || "Submission failed." });
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <span className="text-xs font-mono text-slate-400">Loading contest workspace...</span>
        </div>
      </div>
    );
  }

  if (error || !contest || !problem) {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl bg-[#0a0d14] border border-white/[0.08] p-8 text-center">
          <h2 className="text-base font-bold text-white mb-2">Access Restricted</h2>
          <p className="text-xs text-slate-400 mb-6">{error || "Problem is not accessible at this time."}</p>
          <Link
            href={`/contests/${contestId}`}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500"
          >
            ← Return to Contest Hub
          </Link>
        </div>
      </div>
    );
  }

  const countdown = mounted ? formatCountdown(contest.end_time) : { text: "00:00:00", isUrgent: false };
  const alphabetIndex = (idx) => String.fromCharCode(65 + idx);

  return (
    <div className="h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white overflow-hidden">
      {/* Contest Top Header Navigation Bar */}
      <header className="h-12 border-b border-white/[0.08] bg-[#0a0d14] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href={`/contests/${contestId}`}
            className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Contest Hub</span>
          </Link>

          <span className="text-slate-600">|</span>

          {/* Problem Selector Pills */}
          <div className="flex items-center gap-1">
            {contest.problems?.map((p, idx) => {
              const isCurrent = String(p.problem_id) === String(problemId);
              return (
                <Link
                  key={p.id}
                  href={`/contests/${contestId}/problems/${p.problem_id}`}
                  className={`w-7 h-7 rounded-lg text-xs font-mono font-bold flex items-center justify-center transition-all ${
                    isCurrent
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                  }`}
                  title={p.title}
                >
                  {alphabetIndex(idx)}
                </Link>
              );
            })}
          </div>

          <span className="text-xs font-bold text-white truncate max-w-[200px] hidden md:inline">
            {problem.title}
          </span>
        </div>

        {/* Center: Live Contest Countdown Bar */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-mono font-bold border transition-colors ${
              countdown.isUrgent
                ? "bg-rose-950/60 border-rose-500/50 text-rose-300 animate-pulse"
                : "bg-black/40 border-white/[0.08] text-emerald-400"
            }`}
          >
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{countdown.text}</span>
          </div>
        </div>

        {/* Right: Problem Points & Run / Submit Controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono hidden sm:inline mr-2">
            Points: <strong className="text-indigo-300">{problem.points}</strong>
          </span>

          <button
            type="button"
            disabled={executing}
            onClick={handleRunSampleCode}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.12] text-slate-200 transition-colors disabled:opacity-50"
          >
            Run
          </button>

          <button
            type="button"
            disabled={executing}
            onClick={handleSubmitContestSolution}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/30 disabled:opacity-50"
          >
            {executing ? "Evaluating..." : "Submit Solution"}
          </button>
        </div>
      </header>

      {/* Main Workspace (Split Grid) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Column: Problem Description & Sample Test Cases */}
        <div className="lg:col-span-5 border-r border-white/[0.08] bg-[#07090e] flex flex-col h-full overflow-y-auto p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-indigo-400 font-mono uppercase">
              Contest Problem
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400 font-mono">
              Limit: {problem.time_limit}s / {problem.memory_limit}MB
            </span>
          </div>

          <h1 className="text-xl font-extrabold text-white mb-4">
            {problem.title}
          </h1>

          {/* Problem Statement Rendered */}
          <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed mb-6">
            <ProblemMarkdown content={problem.description} />
          </div>

          {/* Sample Test Cases */}
          {sampleCases.length > 0 && (
            <div className="mt-4 space-y-4">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Sample Test Cases
              </h2>
              {sampleCases.map((sc, i) => (
                <div key={i} className="rounded-xl bg-[#0a0d14] border border-white/[0.06] p-3 text-xs font-mono">
                  <div className="text-[11px] text-indigo-400 mb-1 font-semibold">Sample #{i + 1}</div>
                  <div className="mb-2">
                    <span className="text-slate-500 block text-[10px] uppercase">Input:</span>
                    <pre className="p-2 rounded bg-black/40 text-slate-200 mt-1 overflow-x-auto whitespace-pre-wrap">{sc.input || "No input"}</pre>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Expected Output:</span>
                    <pre className="p-2 rounded bg-black/40 text-slate-200 mt-1 overflow-x-auto whitespace-pre-wrap">{sc.expected_output || "No output"}</pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Code Editor & Execution Console */}
        <div className="lg:col-span-7 flex flex-col h-full overflow-hidden bg-[#0a0d14]">
          {/* Editor Header: Language selector */}
          <div className="h-10 border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0 bg-[#07090e]/80">
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-slate-200 border border-white/[0.06] transition-colors"
              >
                <Image
                  src={SUPPORTED_LANGS.find((l) => l.id === language)?.icon || "/languages/python.png"}
                  alt={language}
                  width={14}
                  height={14}
                />
                <span>{SUPPORTED_LANGS.find((l) => l.id === language)?.name}</span>
                <span className="text-[10px] text-slate-500">▼</span>
              </button>

              {langDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-36 rounded-xl bg-[#0d111a] border border-white/[0.1] shadow-2xl py-1 z-30">
                  {SUPPORTED_LANGS.map((lang) => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => handleLanguageChange(lang.id)}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
                        language === lang.id
                          ? "bg-indigo-600/30 text-indigo-300 font-semibold"
                          : "text-slate-300 hover:bg-white/[0.06]"
                      }`}
                    >
                      <Image src={lang.icon} alt={lang.name} width={14} height={14} />
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setCode(DEFAULT_TEMPLATES[language] || "")}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              Reset to Boilerplate
            </button>
          </div>

          {/* Monaco Editor Pane */}
          <div className="flex-1 min-h-[300px]">
            <MonacoEditor
              height="100%"
              language={SUPPORTED_LANGS.find((l) => l.id === language)?.monacoLang || "python"}
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || "")}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 12, bottom: 12 },
                lineNumbers: "on",
                renderLineHighlight: "all",
                automaticLayout: true,
              }}
            />
          </div>

          {/* Execution & Output Console (Bottom Panel) */}
          <div className="h-64 border-t border-white/[0.08] bg-[#07090e] flex flex-col shrink-0">
            {/* Console Tabs */}
            <div className="h-9 border-b border-white/[0.06] px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {[
                  { id: "testcases", label: "Sample Cases" },
                  { id: "result", label: "Execution Verdict" },
                  { id: "my-attempts", label: "My Contest Attempts" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveConsoleTab(tab.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      activeConsoleTab === tab.id
                        ? "bg-white/[0.08] text-white"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {executing && (
                <div className="flex items-center gap-2 text-xs font-mono text-indigo-400">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                  <span>Evaluating code...</span>
                </div>
              )}
            </div>

            {/* Console Content */}
            <div className="flex-1 overflow-y-auto p-4 text-xs font-mono">
              {activeConsoleTab === "testcases" && (
                <div>
                  <div className="flex gap-2 mb-3">
                    {sampleCases.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedTestCaseIdx(i)}
                        className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                          selectedTestCaseIdx === i
                            ? "bg-indigo-600 text-white font-bold"
                            : "bg-white/[0.04] text-slate-400 hover:text-white"
                        }`}
                      >
                        Case #{i + 1}
                      </button>
                    ))}
                  </div>

                  {sampleCases[selectedTestCaseIdx] && (
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase">Input</span>
                        <pre className="p-2 rounded bg-black/40 text-slate-200 mt-1 whitespace-pre-wrap">
                          {sampleCases[selectedTestCaseIdx].input || "(Empty)"}
                        </pre>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase">Expected Output</span>
                        <pre className="p-2 rounded bg-black/40 text-slate-200 mt-1 whitespace-pre-wrap">
                          {sampleCases[selectedTestCaseIdx].expected_output || "(Empty)"}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeConsoleTab === "result" && (
                <div>
                  {executing ? (
                    <div className="py-8 text-center text-slate-400 flex flex-col items-center gap-2">
                      <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                      <span>Judging execution against test suite...</span>
                    </div>
                  ) : !execResult ? (
                    <div className="py-8 text-center text-slate-500">
                      Click &quot;Run&quot; or &quot;Submit Solution&quot; to test your code.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-xs uppercase ${
                              execStatus === "completed" || execStatus === "accepted"
                                ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/40"
                                : "bg-rose-950/60 text-rose-400 border border-rose-500/40"
                            }`}
                          >
                            {execResult.status || execStatus}
                          </span>
                          {execResult.time_taken !== undefined && (
                            <span className="text-slate-400 text-xs">
                              Time: {execResult.time_taken}s
                            </span>
                          )}
                        </div>

                        {execResult.score !== undefined && (
                          <div className="text-xs">
                            Score: <strong className="text-indigo-300 font-bold">{execResult.score}</strong> / {execResult.max_score || problem.points}
                          </div>
                        )}
                      </div>

                      {execResult.error && (
                        <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs whitespace-pre-wrap">
                          {execResult.error}
                        </div>
                      )}

                      {execResult.output && (
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase">Output:</span>
                          <pre className="p-2 rounded bg-black/40 text-slate-200 mt-1 whitespace-pre-wrap">{execResult.output}</pre>
                        </div>
                      )}

                      {execResult.results && Array.isArray(execResult.results) && (
                        <div className="space-y-1.5 mt-2">
                          {execResult.results.map((r, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                              <span>Test Case #{i + 1}</span>
                              <span className={r.status === "passed" ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                                {r.status?.toUpperCase() || "FAIL"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeConsoleTab === "my-attempts" && (
                <div>
                  {myAttempts.length === 0 ? (
                    <div className="py-8 text-center text-slate-500">
                      No attempts recorded for this problem yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {myAttempts.map((att) => (
                        <div key={att.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              att.status === "accepted" ? "bg-emerald-950/60 text-emerald-400" : "bg-rose-950/60 text-rose-400"
                            }`}>
                              {att.status.toUpperCase()}
                            </span>
                            <span className="text-slate-400">{att.tests_passed} / {att.total_tests} tests</span>
                          </div>
                          <div className="text-slate-500 text-[11px]">
                            {new Date(att.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
