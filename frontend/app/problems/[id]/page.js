"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { useAuth } from "@/lib/AuthContext";
import MarkdownRenderer from "@/components/MarkdownRenderer";

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
  {
    id: "python",
    name: "Python 3",
    icon: "/languages/python.png",
    version: "Python 3.12.3",
    monacoLang: "python",
  },
  {
    id: "java",
    name: "Java",
    icon: "/languages/java.png",
    version: "OpenJDK 21",
    monacoLang: "java",
  },
  {
    id: "cpp",
    name: "C++",
    icon: "/languages/cpp.png",
    version: "GCC 13",
    monacoLang: "cpp",
  },
  {
    id: "javascript",
    name: "JavaScript",
    icon: "/languages/java-script.png",
    version: "Node 20",
    monacoLang: "javascript",
  },
  {
    id: "c",
    name: "C",
    icon: "/languages/c.png",
    version: "GCC 13",
    monacoLang: "c",
  },
];

const DEFAULT_TEMPLATES = {
  python: `def solve():\n    # Read input from standard input\n    # Write your solution here\n    pass\n\nif __name__ == "__main__":\n    solve()\n`,
  java: `import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        // Write your solution here\n    }\n}\n`,
  cpp: `#include <iostream>\n#include <vector>\n#include <string>\n\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    // Write your solution here\n    return 0;\n}\n`,
  javascript: `const fs = require('fs');\n\nfunction solve() {\n    const input = fs.readFileSync('/dev/stdin', 'utf-8');\n    // Write your solution here\n}\n\nsolve();\n`,
  c: `#include <stdio.h>\n#include <stdlib.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n`,
};

function getBoilerplateCode(lang, templates) {
  if (!lang) return "";
  const foundTmpl = templates?.find(
    (t) => t.language?.toLowerCase() === lang.toLowerCase()
  );
  return foundTmpl?.boilerplate_code || DEFAULT_TEMPLATES[lang] || "";
}

export default function ProblemDetailPage() {
  const routeParams = useParams();
  const problemId = routeParams?.id;
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();

  // Problem data state
  const [problemData, setProblemData] = useState(null);
  const [sampleCases, setSampleCases] = useState([]);
  const [customCases, setCustomCases] = useState([]); // user-added custom test cases for RUN ONLY
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Editor state
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(DEFAULT_TEMPLATES.python);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const editorRef = useRef(null);
  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // Layout & Resizing State
  const [leftWidth, setLeftWidth] = useState(42); // percentage
  const [testcaseHeight, setTestcaseHeight] = useState(230); // in px
  const [isTestcaseCollapsed, setIsTestcaseCollapsed] = useState(false);
  const [isDraggingH, setIsDraggingH] = useState(false);
  const [isDraggingV, setIsDraggingV] = useState(false);
  const rightPanelRef = useRef(null);

  // Test Case & Results Panel State
  const [activeTab, setActiveTab] = useState("testcases"); // "testcases" | "custom_input" | "result"
  const [expandedCaseId, setExpandedCaseId] = useState(null); // which testcase row is expanded
  const [customInputText, setCustomInputText] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCaseInput, setNewCaseInput] = useState("");
  const [newCaseExpected, setNewCaseExpected] = useState("");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalAction, setLoginModalAction] = useState("run"); // "run" | "submit"

  // Execution state
  const [executing, setExecuting] = useState(false);
  const [execMode, setExecMode] = useState("run"); // "run" | "submit"
  const [submissionId, setSubmissionId] = useState(null);
  const [execResult, setExecResult] = useState(null);
  const [execStatus, setExecStatus] = useState(""); // "queued" | "running" | "completed" | "failed" | "tle"

  const sseRef = useRef(null);
  const pollTimerRef = useRef(null);

  // Current language object
  const currentLangObj =
    SUPPORTED_LANGS.find((l) => l.id === language) || SUPPORTED_LANGS[0];

  // Clean up SSE and Polling
  const cleanupLiveExecution = () => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  // Fetch problem data on mount
  useEffect(() => {
    if (!problemId) return;
    let isMounted = true;

    async function fetchProblem() {
      setLoading(true);
      setError("");
      try {
        const full = await api.get(`/api-v1/problems/${problemId}/full`);
        if (!isMounted) return;
        setProblemData(full);

        // Load sample test cases from full response or fallback
        let samples = full.run_test_cases || [];
        if (!samples || samples.length === 0) {
          try {
            const dbTcs = await api.get(
              `/api-v1/problems/${problemId}/test-cases`
            );
            if (Array.isArray(dbTcs) && dbTcs.length > 0) {
              const sampleOnly = dbTcs.filter((tc) => tc.is_sample);
              samples = sampleOnly.length > 0 ? sampleOnly : dbTcs.slice(0, 4);
            }
          } catch { }
        }
        setSampleCases(samples);

        // Check if starter template exists for initial language
        setCode(getBoilerplateCode(languageRef.current, full.templates));
      } catch (err) {
        if (!isMounted) return;
        try {
          const prob = await api.get(`/api-v1/problems/${problemId}`);
          setProblemData({ problem: prob, run_test_cases: [] });
          const dbTcs = await api.get(
            `/api-v1/problems/${problemId}/test-cases`
          );
          setSampleCases(dbTcs || []);
        } catch (fallbackErr) {
          setError(fallbackErr.message || "Problem not found.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchProblem();

    return () => {
      isMounted = false;
      cleanupLiveExecution();
    };
  }, [problemId]);

  const rafHRef = useRef(null);
  const rafVRef = useRef(null);

  // Horizontal Resize Listener (Left vs Right Panel) - 60fps RAF batched
  useEffect(() => {
    if (!isDraggingH) return;

    const handlePointerMove = (e) => {
      if (rafHRef.current) cancelAnimationFrame(rafHRef.current);
      rafHRef.current = requestAnimationFrame(() => {
        const windowWidth = window.innerWidth;
        const newPct = (e.clientX / windowWidth) * 100;
        if (newPct >= 20 && newPct <= 80) {
          setLeftWidth(newPct);
        }
      });
    };

    const handlePointerUp = () => {
      setIsDraggingH(false);
      if (rafHRef.current) cancelAnimationFrame(rafHRef.current);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      if (rafHRef.current) cancelAnimationFrame(rafHRef.current);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDraggingH]);

  // Vertical Resize Listener (Monaco Editor vs Testcases Panel) - 60fps RAF batched
  useEffect(() => {
    if (!isDraggingV) return;

    const handlePointerMove = (e) => {
      if (rafVRef.current) cancelAnimationFrame(rafVRef.current);
      rafVRef.current = requestAnimationFrame(() => {
        const container = rightPanelRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const newHeight = rect.bottom - e.clientY;
        if (newHeight >= 60 && newHeight <= rect.height - 80) {
          setTestcaseHeight(newHeight);
          setIsTestcaseCollapsed(false);
        }
      });
    };

    const handlePointerUp = () => {
      setIsDraggingV(false);
      if (rafVRef.current) cancelAnimationFrame(rafVRef.current);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      if (rafVRef.current) cancelAnimationFrame(rafVRef.current);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDraggingV]);

  // Change programming language
  const handleLanguageChange = (newLangId) => {
    setLanguage(newLangId);
    setLangDropdownOpen(false);

    setCode(getBoilerplateCode(newLangId, problemData?.templates));
  };

  // Reset editor to starter template
  const handleResetCode = () => {
    if (
      code.trim() &&
      code !== DEFAULT_TEMPLATES[language] &&
      !confirm("Reset current code to starter boilerplate?")
    ) {
      return;
    }
    setCode(getBoilerplateCode(language, problemData?.templates));
  };

  // Add custom test case (FOR RUN ONLY)
  const handleAddCustomCase = () => {
    if (!newCaseInput.trim()) return;
    const newCase = {
      id: `custom-${Date.now()}`,
      input: newCaseInput.trim(),
      expected_output: newCaseExpected.trim(),
      is_custom: true,
    };
    setCustomCases((prev) => [...prev, newCase]);
    setNewCaseInput("");
    setNewCaseExpected("");
    setShowAddModal(false);
  };

  // Remove custom test case
  const handleRemoveCustomCase = (caseId, e) => {
    e.stopPropagation();
    setCustomCases((prev) => prev.filter((c) => c.id !== caseId));
  };

  // Trigger Execution (Run or Submit)
  const handleExecute = async (mode) => {
    if (authLoading) return;

    if (!user) {
      setLoginModalAction(mode);
      setShowLoginModal(true);
      return;
    }

    if (!code.trim()) {
      setExecStatus("failed");
      setExecResult({
        error: "Please enter your code before running or submitting.",
      });
      setActiveTab("result");
      if (isTestcaseCollapsed) {
        setIsTestcaseCollapsed(false);
      }
      return;
    }

    cleanupLiveExecution();
    setExecuting(true);
    setExecMode(mode);
    setExecStatus("queued");
    setExecResult(null);

    // If panel is collapsed, uncollapse to show progress
    if (isTestcaseCollapsed) {
      setIsTestcaseCollapsed(false);
    }

    const endpoint =
      mode === "submit" ? "/api-v1/code/submit" : "/api-v1/code/run";

    const payload = {
      problem_id: parseInt(problemId, 10),
      user_code: code,
      language: language,
    };

    // If RUN mode: include custom input or custom cases (NEVER FOR SUBMIT)
    if (mode === "run") {
      if (activeTab === "custom_input" && customInputText.trim()) {
        payload.test_cases = [
          {
            input: customInputText.trim(),
            expected_output: "",
            weight: 1.0,
          },
        ];
      } else {
        // Run with sample cases (plus any custom cases if added)
        const allRunCases = [
          ...sampleCases.map((sc) => ({
            input: sc.input,
            expected_output: sc.expected_output,
            weight: 1.0,
          })),
          ...customCases.map((cc) => ({
            input: cc.input,
            expected_output: cc.expected_output,
            weight: 1.0,
          })),
        ];
        payload.test_cases = allRunCases;
      }
    }

    try {
      const initRes = await api.post(endpoint, payload);
      const subId = initRes.submission;
      setSubmissionId(subId);

      // Connect SSE
      connectSSE(subId, mode);

      // Start fallback polling
      pollTimerRef.current = setInterval(() => {
        pollStatus(subId, mode);
      }, 1400);
    } catch (err) {
      setExecStatus("failed");
      setExecResult({
        error: err.message || "Failed to trigger code execution.",
      });
      setExecuting(false);
    }
  };

  // SSE Stream listener
  const connectSSE = (subId, mode) => {
    try {
      const sseUrl = `${API_URL}/api-v1/code/stream/${subId}`;
      const es = new EventSource(sseUrl, { withCredentials: true });
      sseRef.current = es;

      es.addEventListener("result", (event) => {
        try {
          const parsed = JSON.parse(event.data);
          handleFinalResult(parsed, mode, subId);
          cleanupLiveExecution();
        } catch (e) {
          console.error("Failed to parse SSE payload", e);
        }
      });

      es.onerror = () => {
        if (sseRef.current) {
          sseRef.current.close();
          sseRef.current = null;
        }
      };
    } catch { }
  };

  // Polling fallback
  const pollStatus = async (subId, mode) => {
    try {
      const data = await api.get(`/api-v1/code/submission/poll/${subId}`);
      const st = data.status;

      if (
        st === "completed" ||
        st === "failed" ||
        st === "tle" ||
        st === "compile_error" ||
        st === "accepted" ||
        st === "wrong_answer"
      ) {
        handleFinalResult(data, mode, subId);
        cleanupLiveExecution();
      } else {
        setExecStatus(st || "running");
      }
    } catch (err) {
      if (err.status === 404) {
        // In Redis queue
      }
    }
  };

  // Process completed execution verdict
  const handleFinalResult = (resultData, mode, subId) => {
    setExecuting(false);
    setExecStatus(resultData.status || "completed");

    let parsedTestResults = [];
    if (resultData.results) {
      try {
        parsedTestResults =
          typeof resultData.results === "string"
            ? JSON.parse(resultData.results)
            : resultData.results;
      } catch {
        parsedTestResults = [];
      }
    }

    const finalObj = {
      ...resultData,
      testCasesList: parsedTestResults,
    };

    setExecResult(finalObj);

    if (mode === "submit") {
      refreshUser?.();

      if (
        (resultData.status === "completed" ||
          resultData.status === "accepted") &&
        resultData.score > 0
      ) {
        try {
          const stored = localStorage.getItem("code_zero_solved_ids");
          const ids = stored ? JSON.parse(stored) : [];
          if (!ids.includes(parseInt(problemId, 10))) {
            ids.push(parseInt(problemId, 10));
            localStorage.setItem("code_zero_solved_ids", JSON.stringify(ids));
          }
        } catch { }
      }

      // Record in session submission history
      try {
        const historyKey = "code_zero_my_submissions";
        const currentHist = JSON.parse(
          localStorage.getItem(historyKey) || "[]"
        );
        currentHist.unshift({
          id: subId,
          problem_id: parseInt(problemId, 10),
          problem_title: problemData?.problem?.title || `Problem ${problemId}`,
          language: language,
          status: resultData.status,
          score: resultData.score || 0,
          max_score: resultData.max_score || 0,
          time_taken: resultData.time_taken || 0,
          created_at: new Date().toISOString(),
          code: code,
          results: parsedTestResults,
        });
        localStorage.setItem(
          historyKey,
          JSON.stringify(currentHist.slice(0, 50))
        );
      } catch { }
    }
  };

  const handleMonacoMount = (editor) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({
        line: e.position.lineNumber,
        col: e.position.column,
      });
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] bg-[#07090e] text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
        <div className="text-xs font-mono text-slate-400">
          Loading problem environment...
        </div>
      </div>
    );
  }

  if (error || !problemData?.problem) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="bg-[#0e1322] border border-white/10 rounded-2xl p-8 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-2">Problem Not Found</h2>
          <p className="text-sm text-slate-400 mb-6">
            {error || "The requested problem challenge does not exist."}
          </p>
          <Link
            href="/problems"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-full text-white text-xs font-semibold shadow-md transition-all inline-flex items-center gap-2"
          >
            <span>← Back to Problems</span>
          </Link>
        </div>
      </div>
    );
  }

  const prob = problemData.problem;

  // Combine sample testcases and custom testcases for display
  const allDisplayCases = [
    ...sampleCases.map((c, i) => ({ ...c, displayIdx: i + 1, isCustom: false })),
    ...customCases.map((c, i) => ({
      ...c,
      displayIdx: sampleCases.length + i + 1,
      isCustom: true,
    })),
  ];

  return (
    <div className="h-[calc(100vh-3.25rem)] sm:h-[calc(100vh-3.5rem)] flex flex-col bg-[#07090e] text-slate-200 overflow-hidden select-none p-1.5 sm:p-2 pt-1 sm:pt-1.5">
      {/* Invisible overlay during drag to prevent Monaco event interception */}
      {(isDraggingH || isDraggingV) && (
        <div
          className={`fixed inset-0 z-50 select-none ${isDraggingH ? "cursor-col-resize" : "cursor-row-resize"
            }`}
          style={{ background: "transparent" }}
        />
      )}

      {/* --- MAIN RESIZABLE LAYOUT --- */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden relative">
        {/* ========================================================= */}
        {/* LEFT PANEL: PROBLEM STATEMENT, EXAMPLES & CONSTRAINTS     */}
        {/* ========================================================= */}
        <div
          style={{ width: `${leftWidth}%` }}
          className="h-full min-h-0 shrink-0 min-w-[280px] max-w-[70%] flex flex-col bg-[#0a0d14] border border-white/[0.08] rounded-2xl shadow-lg shadow-black/40 overflow-hidden relative select-text hover:border-white/[0.14] transition-colors"
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4.5 space-y-3.5 max-w-none no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Back Link */}
            <Link
              href="/problems"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors group"
            >
              <svg
                className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Problems</span>
            </Link>

            {/* Title & Difficulty Pill */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {prob.title}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{prob.difficulty || "Easy"}</span>
              </span>
            </div>

            {/* Stats Row (Time Limit, Memory Limit, Success Rate) */}
            <div className="grid grid-cols-3 gap-2 py-2 border-y border-white/[0.06]">
              {/* Time Limit */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
                  </svg>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium leading-none">Time Limit</div>
                  <div className="text-xs font-bold text-white font-mono mt-0.5">
                    {prob.time_limit || "1.0"}s
                  </div>
                </div>
              </div>

              {/* Memory Limit */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7c0-2-1.5-3-3.5-3h-9C5.5 4 4 5 4 7z" />
                    <path d="M4 10h16M4 14h16" />
                  </svg>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium leading-none">Memory Limit</div>
                  <div className="text-xs font-bold text-white font-mono mt-0.5">
                    {prob.memory_limit || "256"}MB
                  </div>
                </div>
              </div>

              {/* Success Rate */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium leading-none">Success Rate</div>
                  <div className="text-xs font-bold text-white font-mono mt-0.5">82.4%</div>
                </div>
              </div>
            </div>

            {/* Problem Description Body */}
            <div className="text-xs sm:text-[13px] text-slate-300 leading-relaxed font-normal">
              <MarkdownRenderer content={prob.description} />
            </div>

            {/* Fallback Examples Section (only shown if not provided in markdown description) */}
            {!prob.description?.toLowerCase().includes("example") && (
              <div className="space-y-4 pt-2">
                <h2 className="text-sm font-bold text-white tracking-tight uppercase">Examples</h2>

                {sampleCases && sampleCases.length > 0 ? (
                  <div className="space-y-3.5">
                    {sampleCases.slice(0, 3).map((sc, idx) => (
                      <div
                        key={idx}
                        className="bg-[#0b0e17] border border-white/[0.08] rounded-2xl p-4.5 space-y-2 text-xs font-mono shadow-sm"
                      >
                        <div className="text-xs font-bold text-slate-200 font-sans mb-1">
                          Example {idx + 1}
                        </div>
                        <div className="text-slate-300">
                          <strong className="text-slate-400 font-sans">Input: </strong>
                          <span className="text-indigo-200 whitespace-pre-wrap">{sc.input}</span>
                        </div>
                        <div className="text-slate-300">
                          <strong className="text-slate-400 font-sans">Output: </strong>
                          <span className="text-emerald-300 whitespace-pre-wrap">{sc.expected_output}</span>
                        </div>
                        {sc.explanation && (
                          <div className="text-slate-400 font-sans text-[11px] pt-1">
                            <strong>Explanation: </strong>
                            <span>{sc.explanation}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#0b0e17] border border-white/[0.08] rounded-2xl p-4 text-xs text-slate-400">
                    Refer to the problem description for sample input and output structure.
                  </div>
                )}
              </div>
            )}

            {/* Fallback Constraints (only shown if not provided in markdown description) */}
            {!prob.description?.toLowerCase().includes("constraint") && (
              <div className="space-y-3 pt-2">
                <h2 className="text-sm font-bold text-white tracking-tight uppercase">Constraints</h2>
                <ul className="space-y-1.5 text-xs text-slate-400 font-mono list-disc list-inside">
                  <li>Refer to problem statement for input/output constraints.</li>
                </ul>
              </div>
            )}

            {/* Helpful Tip Card */}
            {prob.title?.toLowerCase().includes("two sum") && (
              <div className="rounded-2xl border border-indigo-500/25 bg-gradient-to-r from-indigo-950/30 to-purple-950/20 p-4.5 flex items-start gap-3.5 shadow-sm">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-white tracking-wide mb-0.5">Tip</div>
                  <div className="text-xs text-slate-400 leading-relaxed font-sans">
                    A simple hash map can help you solve this in O(n) time with optimal space efficiency.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* HORIZONTAL RESIZE DIVIDER (DRAGGABLE HANDLE)              */}
        {/* ========================================================= */}
        <div
          onPointerDown={() => setIsDraggingH(true)}
          className={`hidden lg:flex w-2 cursor-col-resize items-center justify-center transition-all z-20 shrink-0 select-none py-6 group ${
            isDraggingH ? "w-2" : ""
          }`}
          title="Drag to resize panel"
        >
          <div
            className={`w-1 h-8 rounded-full transition-all ${
              isDraggingH
                ? "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.9)] w-1.5"
                : "bg-slate-700/50 group-hover:bg-indigo-400 group-hover:w-1.5"
            }`}
          />
        </div>

        {/* ========================================================= */}
        {/* RIGHT PANEL: EDITOR (TOP) + RESIZABLE TESTCASES (BOTTOM)  */}
        {/* ========================================================= */}
        <div
          ref={rightPanelRef}
          className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden"
        >
          {/* Top Card: Monaco Editor */}
          <div className="flex-1 min-h-0 flex flex-col bg-[#0a0d14] border border-white/[0.08] rounded-2xl shadow-lg shadow-black/40 overflow-hidden relative hover:border-white/[0.14] transition-colors">
            {/* Top Bar: Language Tabs / Selector + Run & Submit Buttons */}
            <div className="h-10 sm:h-11 bg-[#0d121f] border-b border-white/[0.08] px-3 sm:px-3.5 flex items-center justify-between shrink-0 z-20">
              {/* Left: Language Selection Tabs with PNG icons */}
              <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1 scrollbar-none">
                {SUPPORTED_LANGS.slice(0, 4).map((lang) => {
                  const isSelected = language === lang.id;
                  return (
                    <button
                      key={lang.id}
                      onClick={() => handleLanguageChange(lang.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${isSelected
                          ? "bg-[#111628] text-white border border-indigo-500/50 shadow-xs"
                          : "bg-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                        }`}
                    >
                      <Image
                        src={lang.icon}
                        alt={lang.name}
                        width={14}
                        height={14}
                        className="w-3.5 h-3.5 object-contain"
                      />
                      <span>{lang.name}</span>
                    </button>
                  );
                })}

                {/* Language Dropdown for Additional Languages (C, etc.) */}
                <div className="relative">
                  <button
                    onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                    className="px-2 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors flex items-center gap-1"
                    title="More languages"
                  >
                    <span>▼</span>
                  </button>

                  {langDropdownOpen && (
                    <div className="absolute left-0 mt-1.5 w-44 bg-[#0e1322] border border-white/10 rounded-xl shadow-2xl py-1 z-50 backdrop-blur-xl">
                      {SUPPORTED_LANGS.map((lang) => (
                        <button
                          key={lang.id}
                          onClick={() => handleLanguageChange(lang.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-colors ${language === lang.id
                              ? "bg-indigo-600/20 text-indigo-300 font-semibold"
                              : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                            }`}
                        >
                          <Image
                            src={lang.icon}
                            alt={lang.name}
                            width={14}
                            height={14}
                            className="w-3.5 h-3.5 object-contain"
                          />
                          <span>{lang.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Reset, Run & Submit Action Buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Reset to starter template */}
                <button
                  onClick={handleResetCode}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0e1322] hover:bg-[#141b2c] border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all shadow-xs"
                  title="Reset code to starter template"
                >
                  <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="hidden sm:inline">Reset</span>
                </button>

                {/* RUN BUTTON */}
                <button
                  onClick={() => handleExecute("run")}
                  disabled={executing}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-sm shadow-indigo-600/30 active:scale-98 transition-all disabled:opacity-50"
                >
                  {executing && execMode === "run" ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Running...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                      <span>Run</span>
                    </>
                  )}
                </button>

                {/* SUBMIT BUTTON */}
                <button
                  onClick={() => handleExecute("submit")}
                  disabled={executing}
                  className="flex items-center gap-1.5 px-3.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm shadow-emerald-600/30 active:scale-98 transition-all disabled:opacity-50"
                >
                  {executing && execMode === "submit" ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Submit</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Monaco Editor Container */}
            <div className="flex-1 min-h-0 relative flex flex-col bg-[#0a0d14] overflow-hidden">
              <div className={`flex-1 w-full min-h-0 ${isDraggingH || isDraggingV ? "pointer-events-none select-none" : ""}`}>
                <MonacoEditor
                  height="100%"
                  language={currentLangObj.monacoLang}
                  theme="vs-dark"
                  value={code}
                  onChange={(val) => setCode(val || "")}
                  onMount={handleMonacoMount}
                  options={{
                    fontSize: 13,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    minimap: { enabled: false },
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    lineNumbers: "on",
                    tabSize: 4,
                    wordWrap: "on",
                    cursorBlinking: "smooth",
                    smoothScrolling: true,
                    padding: { top: 10, bottom: 10 },
                  }}
                />
              </div>

              {/* Editor Bottom Status Bar */}
              <div className="h-5.5 bg-[#0d121f] border-t border-white/[0.06] px-3 flex items-center justify-between text-[11px] font-mono text-slate-500 shrink-0 select-none">
                <div className="flex items-center gap-2">
                  <span>{currentLangObj.version}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
                  <span>Spaces: 4</span>
                  <span>UTF-8</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* VERTICAL RESIZE DIVIDER (DRAGGABLE HANDLE)                */}
          {/* ========================================================= */}
          <div
            onPointerDown={() => setIsDraggingV(true)}
            className={`h-2 w-full cursor-row-resize flex items-center justify-center transition-all z-20 shrink-0 select-none group ${
              isDraggingV ? "h-2" : ""
            }`}
            title="Drag to resize test-case panel"
          >
            <div
              className={`h-1 w-10 rounded-full transition-all ${
                isDraggingV
                  ? "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.9)] h-1.5"
                  : "bg-slate-700/50 group-hover:bg-indigo-400 group-hover:h-1.5"
              }`}
            />
          </div>

          {/* ========================================================= */}
          {/* BOTTOM PANEL: TEST CASES & EXECUTION CONSOLE              */}
          {/* ========================================================= */}
          <div
            style={{
              height: isTestcaseCollapsed ? "38px" : `${testcaseHeight}px`,
            }}
            className={`flex flex-col bg-[#0a0d14] border border-white/[0.08] rounded-2xl shadow-lg shadow-black/40 overflow-hidden relative shrink-0 hover:border-white/[0.14] transition-colors ${
              isDraggingV ? "" : "transition-[height] duration-200 ease-out"
            }`}
          >
            {/* Header: Tabs + Actions (Add Test Case, Run All, Collapse) */}
            <div className="h-9.5 sm:h-10 bg-[#0d121f] border-b border-white/[0.08] px-3 sm:px-3.5 flex items-center justify-between shrink-0">
              {/* Left Tabs */}
              <div className="flex items-center space-x-5 h-full">
                {/* Tab: Test Cases */}
                <button
                  onClick={() => {
                    setActiveTab("testcases");
                    setIsTestcaseCollapsed(false);
                  }}
                  className={`relative h-full flex items-center text-xs font-semibold transition-colors ${activeTab === "testcases"
                      ? "text-white"
                      : "text-slate-400 hover:text-white"
                    }`}
                >
                  <span>Test Cases</span>
                  {activeTab === "testcases" && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.9)]" />
                  )}
                </button>

                {/* Tab: Custom Input */}
                <button
                  onClick={() => {
                    setActiveTab("custom_input");
                    setIsTestcaseCollapsed(false);
                  }}
                  className={`relative h-full flex items-center text-xs font-semibold transition-colors ${activeTab === "custom_input"
                      ? "text-white"
                      : "text-slate-400 hover:text-white"
                    }`}
                >
                  <span>Custom Input</span>
                  {activeTab === "custom_input" && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.9)]" />
                  )}
                </button>

                {/* Tab: Result / Verdict (shown when executed) */}
                {execResult && (
                  <button
                    onClick={() => {
                      setActiveTab("result");
                      setIsTestcaseCollapsed(false);
                    }}
                    className={`relative h-full flex items-center gap-1.5 text-xs font-semibold transition-colors ${activeTab === "result"
                        ? "text-white"
                        : "text-slate-400 hover:text-white"
                      }`}
                  >
                    <span>Results</span>
                    <span
                      className={`w-2 h-2 rounded-full ${execResult.status === "completed" ||
                          execResult.status === "accepted"
                          ? "bg-emerald-400"
                          : "bg-rose-400"
                        }`}
                    />
                    {activeTab === "result" && (
                      <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.9)]" />
                    )}
                  </button>
                )}
              </div>

              {/* Right Panel Actions */}
              <div className="flex items-center gap-2">
                {/* Add Test Case button */}
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-[#0e1322] hover:bg-[#141b2c] border border-white/10 text-xs text-slate-300 hover:text-white font-medium transition-colors flex items-center gap-1"
                  title="Add custom test case for Run"
                >
                  <span className="text-indigo-400 font-bold">+</span>
                  <span>Add Test Case</span>
                </button>

                {/* Run All / Run button inside test-case header */}
                <button
                  onClick={() => handleExecute("run")}
                  disabled={executing}
                  className="px-2.5 py-1 rounded-lg bg-[#0e1322] hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <span>▷</span>
                  <span>Run All</span>
                </button>

                {/* Collapse / Expand Toggle Button */}
                <button
                  onClick={() => setIsTestcaseCollapsed(!isTestcaseCollapsed)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                  title={isTestcaseCollapsed ? "Expand panel" : "Collapse panel"}
                >
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${isTestcaseCollapsed ? "rotate-180" : ""
                      }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Test Case Content Body (hidden when collapsed) */}
            {!isTestcaseCollapsed && (
              <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-3 select-text font-mono text-xs scrollbar-thin">
                {/* ──────────────── TAB 1: STRUCTURED TEST CASES TABLE ──────────────── */}
                {activeTab === "testcases" && (
                  <div className="space-y-1.5">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 px-2.5 py-1 text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider border-b border-white/[0.06]">
                      <div className="col-span-1 text-center">#</div>
                      <div className="col-span-5">Input</div>
                      <div className="col-span-3">Expected Output</div>
                      <div className="col-span-2 text-center">Status</div>
                      <div className="col-span-1 text-right">Details</div>
                    </div>

                    {/* Table Rows */}
                    {allDisplayCases.map((tc, idx) => {
                      const isExpanded = expandedCaseId === tc.displayIdx;
                      const resultCase =
                        execResult?.testCasesList?.[idx] || null;

                      let statusBadge = (
                        <span className="text-[10px] text-slate-400">Ready</span>
                      );

                      if (executing) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 text-[10px] text-indigo-400 animate-pulse">
                            <span>Running</span>
                          </span>
                        );
                      } else if (resultCase) {
                        const passed =
                          resultCase.passed ||
                          resultCase.status === "passed" ||
                          resultCase.status === "accepted";
                        statusBadge = passed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50">
                            <span>✓</span> Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-rose-400 bg-rose-950/40 border border-rose-800/50">
                            <span>✗</span> Failed
                          </span>
                        );
                      }

                      return (
                        <div
                          key={tc.id || idx}
                          onClick={() =>
                            setExpandedCaseId(isExpanded ? null : tc.displayIdx)
                          }
                          className={`rounded-lg border transition-all cursor-pointer ${isExpanded
                              ? "bg-[#0d1222] border-indigo-500/40 shadow-sm"
                              : "bg-[#0b0e17] hover:bg-[#0e1322] border-white/[0.06]"
                            }`}
                        >
                          {/* Row Summary */}
                          <div className="grid grid-cols-12 gap-2 px-2.5 py-1.5 items-center">
                            <div className="col-span-1 text-center font-bold text-slate-400 text-xs">
                              {tc.displayIdx}
                            </div>
                            <div className="col-span-5 text-indigo-200 truncate pr-2 font-mono text-xs">
                              {tc.input}
                            </div>
                            <div className="col-span-3 text-emerald-300 truncate pr-2 font-mono text-xs">
                              {tc.expected_output || "(any)"}
                            </div>
                            <div className="col-span-2 text-center">
                              {statusBadge}
                            </div>
                            <div className="col-span-1 text-right flex items-center justify-end gap-1">
                              {tc.isCustom && (
                                <button
                                  onClick={(e) => handleRemoveCustomCase(tc.id, e)}
                                  className="text-slate-500 hover:text-rose-400 p-0.5"
                                  title="Remove custom case"
                                >
                                  ×
                                </button>
                              )}
                              <span
                                className={`text-slate-400 text-xs transition-transform inline-block ${isExpanded ? "rotate-90" : ""
                                  }`}
                              >
                                &gt;
                              </span>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="px-3 pb-3 pt-1 border-t border-white/[0.06] space-y-2 bg-[#080b13] rounded-b-lg">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1.5">
                                <div>
                                  <span className="text-[10px] uppercase font-sans font-bold text-slate-400 block mb-1">
                                    Input
                                  </span>
                                  <pre className="p-2 rounded-lg bg-[#05070c] border border-white/[0.06] text-slate-200 text-xs whitespace-pre-wrap">
                                    {tc.input}
                                  </pre>
                                </div>
                                <div>
                                  <span className="text-[10px] uppercase font-sans font-bold text-slate-400 block mb-1">
                                    Expected Output
                                  </span>
                                  <pre className="p-2 rounded-lg bg-[#05070c] border border-white/[0.06] text-emerald-300 text-xs whitespace-pre-wrap">
                                    {tc.expected_output || "(none)"}
                                  </pre>
                                </div>
                              </div>

                              {/* If test case has run results */}
                              {resultCase && (
                                <div className="space-y-1.5 pt-1.5 border-t border-white/[0.06]">
                                  <div>
                                    <span className="text-[10px] uppercase font-sans font-bold text-slate-400 block mb-0.5">
                                      Your Output
                                    </span>
                                    <pre className="p-2 rounded-lg bg-[#05070c] border border-white/[0.06] text-indigo-200 text-xs whitespace-pre-wrap">
                                      {resultCase.actual_output || resultCase.output || "(no output)"}
                                    </pre>
                                  </div>

                                  {resultCase.stdout && (
                                    <div>
                                      <span className="text-[10px] uppercase font-sans font-bold text-slate-400 block mb-0.5">
                                        Standard Output / Logs
                                      </span>
                                      <pre className="p-2 rounded-lg bg-[#05070c] border border-white/[0.06] text-slate-300 text-xs whitespace-pre-wrap">
                                        {resultCase.stdout}
                                      </pre>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono pt-0.5">
                                    {resultCase.time_taken !== undefined && (
                                      <span>Runtime: {resultCase.time_taken}s</span>
                                    )}
                                    {resultCase.memory !== undefined && (
                                      <span>Memory: {resultCase.memory}MB</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ──────────────── TAB 2: CUSTOM INPUT ──────────────── */}
                {activeTab === "custom_input" && (
                  <div className="space-y-3 font-sans">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300">
                        Custom Standard Input
                      </label>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-medium">
                        Run Only (Excluded from Submit)
                      </span>
                    </div>

                    <textarea
                      rows={4}
                      value={customInputText}
                      onChange={(e) => setCustomInputText(e.target.value)}
                      placeholder="Enter raw input data to pass directly to stdin (e.g. 5\n1 2 3 4 5)..."
                      className="w-full bg-[#080b13] border border-white/10 rounded-lg p-2.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                    />

                    <div className="flex justify-end">
                      <button
                        onClick={() => handleExecute("run")}
                        disabled={executing}
                        className="px-3.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm shadow-indigo-600/30 transition-all flex items-center gap-1.5"
                      >
                        <span>▷ Run with Custom Input</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* ──────────────── TAB 3: EXECUTION RESULTS ──────────────── */}
                {activeTab === "result" && execResult && (
                  <div className="space-y-3">
                    {/* Execution Header Banner */}
                    <div className="flex flex-wrap items-center justify-between p-2.5 rounded-lg border bg-[#0b0e17] border-white/10">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${execResult.status === "accepted" ||
                              execResult.status === "completed"
                              ? "bg-emerald-950/60 border border-emerald-700 text-emerald-300"
                              : "bg-rose-950/60 border border-rose-700 text-rose-300"
                            }`}
                        >
                          {execResult.status}
                        </span>
                        <span className="text-xs text-slate-400 font-sans">
                          Mode:{" "}
                          <strong className="text-white capitalize font-mono">
                            {execMode}
                          </strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono">
                        {execResult.time_taken !== undefined && (
                          <span className="text-slate-400">
                            Runtime:{" "}
                            <strong className="text-white">
                              {execResult.time_taken}s
                            </strong>
                          </span>
                        )}
                        {execResult.tests_passed !== undefined && (
                          <span className="text-slate-400">
                            Tests Passed:{" "}
                            <strong className="text-emerald-400">
                              {execResult.tests_passed}
                            </strong>{" "}
                            / {execResult.total_tests}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stderr / Compilation Error */}
                    {execResult.error && (
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold text-rose-400 font-sans uppercase">
                          Error / Diagnostics
                        </div>
                        <pre className="p-2.5 bg-rose-950/20 border border-rose-800/50 rounded-lg text-xs font-mono text-rose-300 whitespace-pre-wrap overflow-x-auto">
                          {execResult.error}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: ADD CUSTOM TEST CASE (FOR RUN ONLY)                */}
      {/* ========================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1322] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Add Custom Test Case
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 font-sans">
              Custom test cases are evaluated in sandboxed containers during{" "}
              <strong className="text-white">Run</strong> only and never affect
              official <strong className="text-white">Submit</strong> verdicts.
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-[11px] font-sans font-semibold text-slate-300 block mb-1">
                  Test Case Input
                </label>
                <textarea
                  rows={3}
                  value={newCaseInput}
                  onChange={(e) => setNewCaseInput(e.target.value)}
                  placeholder="e.g. nums = [2,7,11,15], target = 9"
                  className="w-full bg-[#080b13] border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-sans font-semibold text-slate-300 block mb-1">
                  Expected Output (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newCaseExpected}
                  onChange={(e) => setNewCaseExpected(e.target.value)}
                  placeholder="e.g. [0,1]"
                  className="w-full bg-[#080b13] border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.05]"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomCase}
                disabled={!newCaseInput.trim()}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 disabled:opacity-50 transition-all"
              >
                Add Test Case
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* POP-CARD: AUTHENTICATION REQUIRED (FOR RUN / SUBMIT)      */}
      {/* ========================================================= */}
      {showLoginModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="relative bg-[#0e1322] border border-white/10 rounded-3xl w-full max-w-md p-6 sm:p-8 space-y-6 shadow-2xl shadow-indigo-950/60 backdrop-blur-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient lighting glows */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Close button */}
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              aria-label="Close modal"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header / Brand Icon */}
            <div className="flex flex-col items-center text-center space-y-3 pt-1">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
                <svg
                  className="w-7 h-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Sign In to {loginModalAction === "submit" ? "Submit Code" : "Run Code"}
                </h3>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed max-w-xs">
                  Please log in to your account to execute code, evaluate test cases, and record your score.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-1">
              <button
                onClick={() => {
                  router.push(`/login?redirect=/problems/${problemId}`);
                }}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <span>Log In to Continue</span>
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>

              <div className="flex items-center justify-between text-xs px-1 text-slate-400">
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="hover:text-white transition-colors text-[11px]"
                >
                  Cancel
                </button>
                <span className="text-[11px]">
                  Don&apos;t have an account?{" "}
                  <Link
                    href="/register"
                    className="text-indigo-400 hover:text-indigo-300 font-semibold underline-offset-2 hover:underline transition-colors"
                  >
                    Register
                  </Link>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
