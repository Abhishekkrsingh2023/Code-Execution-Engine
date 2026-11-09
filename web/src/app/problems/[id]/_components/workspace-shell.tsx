"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { ProblemDescription } from "./problem-description";
import { ProblemSubmissions } from "./problem-submissions";
import { MonacoCodeEditor } from "./monaco-code-editor";
import { TestcasePanel } from "./testcase-panel";
import { ResultPanel } from "./result-panel";
import { GuestLoginModal } from "./guest-login-modal";
import type { FullProblemResponse } from "@/types/problem";
import type { SupportedLanguage, SubmissionPollResponse } from "@/types/execution";
import type { UserResponse } from "@/types/user";
import { Play, Send, RotateCcw, ChevronDown, ChevronUp, Loader2, FileText, History } from "lucide-react";

export const DEFAULT_TEMPLATES: Record<SupportedLanguage, string> = {
  python: `def solve():\n    # Read input from standard input\n    # Write your solution here\n    pass\n\nif __name__ == "__main__":\n    solve()\n`,
  cpp: `#include <iostream>\n#include <vector>\n#include <string>\n\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    // Write your solution here\n    return 0;\n}\n`,
  java: `import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        // Write your solution here\n    }\n}\n`,
  c: `#include <stdio.h>\n#include <stdlib.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n`,
};

export const SUPPORTED_LANGUAGES: Array<{
  id: SupportedLanguage;
  name: string;
  version: string;
  monacoLang: string;
  icon: string;
}> = [
  { id: "python", name: "Python 3", version: "3.12", monacoLang: "python", icon: "/languages/python.png" },
  { id: "cpp", name: "C++", version: "GCC 13", monacoLang: "cpp", icon: "/languages/cpp.png" },
  { id: "java", name: "Java", version: "OpenJDK 21", monacoLang: "java", icon: "/languages/java.png" },
  { id: "c", name: "C", version: "GCC 13", monacoLang: "c", icon: "/languages/c.png" },
];

function getStarterCode(lang: SupportedLanguage, problemData: FullProblemResponse): string {
  const match = problemData.templates?.find(
    (t) => t.language?.toLowerCase() === lang.toLowerCase()
  );
  return match?.boilerplate_code || DEFAULT_TEMPLATES[lang] || "";
}

interface WorkspaceShellProps {
  problemData: FullProblemResponse;
  isAuthenticated: boolean;
  currentUser?: UserResponse | null;
  problemId: number;
}

export function WorkspaceShell({
  problemData,
  isAuthenticated,
  currentUser,
  problemId,
}: WorkspaceShellProps) {
  const [language, setLanguage] = useState<SupportedLanguage>("python");
  const [code, setCode] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const draftKey = `code0_draft_${problemId}_python`;
      const saved = localStorage.getItem(draftKey);
      if (saved !== null && saved.trim() !== "") {
        return saved;
      }
    }
    return getStarterCode("python", problemData);
  });
  const [customInput, setCustomInput] = useState<string>("");

  // Left panel tabs (Description vs Submissions)
  const [activeLeftTab, setActiveLeftTab] = useState<"description" | "submissions">("description");
  const [submissionsRefreshTrigger, setSubmissionsRefreshTrigger] = useState<number>(0);

  // Bottom panel tabs & collapse
  const [activeBottomTab, setActiveBottomTab] = useState<"testcases" | "result">("testcases");
  const [activeTestcaseTab, setActiveTestcaseTab] = useState<"sample" | "custom">("sample");
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState<boolean>(false);

  // Mobile layout tabs (< lg)
  const [mobileTab, setMobileTab] = useState<"problem" | "submissions" | "code" | "output">("problem");

  // Execution state
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [execStatus, setExecStatus] = useState<string>("idle");
  const [execResult, setExecResult] = useState<SubmissionPollResponse | null>(null);
  const [execMode, setExecMode] = useState<"run" | "submit" | null>(null);

  // Guest modal state
  const [guestModalOpen, setGuestModalOpen] = useState<boolean>(false);
  const [guestActionType, setGuestActionType] = useState<"run" | "submit">("run");

  const bottomPanelRef = useRef<ImperativePanelHandle>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleBottomPanel = () => {
    const panel = bottomPanelRef.current;
    if (!panel) return;
    if (bottomPanelCollapsed) {
      panel.expand();
      setBottomPanelCollapsed(false);
    } else {
      panel.collapse();
      setBottomPanelCollapsed(true);
    }
  };

  const cleanupPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupPolling();
    };
  }, [cleanupPolling]);

  const handleLanguageChange = useCallback(
    (newLang: SupportedLanguage) => {
      setLanguage(newLang);
      if (typeof window !== "undefined") {
        const draftKey = `code0_draft_${problemId}_${newLang}`;
        const saved = localStorage.getItem(draftKey);
        if (saved !== null && saved.trim() !== "") {
          setCode(saved);
          return;
        }
      }
      setCode(getStarterCode(newLang, problemData));
    },
    [problemData, problemId]
  );

  // Save draft on edit
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    if (typeof window !== "undefined") {
      localStorage.setItem(`code0_draft_${problemId}_${language}`, newCode);
    }
  };

  // Reset to starter template
  const handleResetCode = () => {
    const starter = getStarterCode(language, problemData);
    setCode(starter);
    if (typeof window !== "undefined") {
      localStorage.setItem(`code0_draft_${problemId}_${language}`, starter);
    }
  };

  // Poll submission status
  const startPolling = useCallback((subId: string, mode: "run" | "submit") => {
    cleanupPolling();
    const startTime = Date.now();
    const timeoutMs = 30000;

    pollTimerRef.current = setInterval(async () => {
      if (Date.now() - startTime > timeoutMs) {
        cleanupPolling();
        setIsExecuting(false);
        setExecStatus("failed");
        setExecResult({
          error: "Execution evaluation timed out after 30 seconds.",
          status: "failed",
        });
        return;
      }

      try {
        const res = await fetch(`/api/code/poll/${subId}`);
        if (!res.ok) return;

        const data = (await res.json()) as SubmissionPollResponse;
        const st = (data.status || "").toLowerCase();

        if (st === "completed" || st === "failed" || st === "tle" || st === "compile_error" || st === "accepted" || st === "wrong_answer") {
          cleanupPolling();
          setIsExecuting(false);
          setExecStatus(st);
          setExecResult(data);
          if (mode === "submit") {
            setSubmissionsRefreshTrigger((prev) => prev + 1);
          }
        } else {
          setExecStatus(st || "running");
        }
      } catch {
        // network retry
      }
    }, 1200);
  }, [cleanupPolling]);

  // Load a past submission into the editor
  const handleLoadPastCode = useCallback(
    (pastCode: string, pastLang: SupportedLanguage) => {
      handleLanguageChange(pastLang);
      setCode(pastCode);
      if (typeof window !== "undefined") {
        localStorage.setItem(`code0_draft_${problemId}_${pastLang}`, pastCode);
      }
      setMobileTab("code");
    },
    [handleLanguageChange, problemId]
  );

  // Trigger Run or Submit
  const handleExecute = async (mode: "run" | "submit") => {
    if (!isAuthenticated) {
      setGuestActionType(mode);
      setGuestModalOpen(true);
      return;
    }

    if (isExecuting) return;

    cleanupPolling();
    setIsExecuting(true);
    setExecMode(mode);
    setExecStatus("queued");
    setExecResult(null);
    setActiveBottomTab("result");
    if (bottomPanelRef.current?.isCollapsed()) {
      bottomPanelRef.current.expand();
    }
    setBottomPanelCollapsed(false);
    setMobileTab("output");

    const endpoint = mode === "submit" ? "/api/code/submit" : "/api/code/run";

    const payload: {
      problem_id: number;
      user_code: string;
      language: SupportedLanguage;
      test_cases?: Array<{ input: string; expected_output: string; weight: number }>;
    } = {
      problem_id: problemId,
      user_code: code,
      language,
    };

    if (mode === "run") {
      if (activeTestcaseTab === "custom" && customInput.trim()) {
        payload.test_cases = [
          {
            input: customInput.trim(),
            expected_output: "",
            weight: 1.0,
          },
        ];
      } else {
        payload.test_cases = (problemData.run_test_cases || []).map((sc) => ({
          input: sc.input,
          expected_output: sc.expected_output,
          weight: 1.0,
        }));
      }
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errDetail = "Execution request failed.";
        try {
          const errData = await res.json();
          if (errData?.detail) errDetail = errData.detail;
        } catch {
          // not json
        }
        setIsExecuting(false);
        setExecStatus("failed");
        setExecResult({ error: errDetail, status: "failed" });
        return;
      }

      const initData = (await res.json()) as { submission: string };
      if (initData?.submission) {
        startPolling(initData.submission, mode);
      } else {
        setIsExecuting(false);
        setExecStatus("failed");
        setExecResult({ error: "Missing submission handle from server.", status: "failed" });
      }
    } catch (err) {
      setIsExecuting(false);
      setExecStatus("failed");
      setExecResult({
        error: err instanceof Error ? err.message : "Failed to trigger code execution.",
        status: "failed",
      });
    }
  };

  const currentLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.id === language) || SUPPORTED_LANGUAGES[0];

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
      {/* Mobile Tab Bar (< lg) */}
      <div className="lg:hidden flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-3 py-1.5 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMobileTab("problem")}
            className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${
              mobileTab === "problem"
                ? "bg-[var(--accent)] text-[var(--foreground)] font-semibold"
                : "text-[var(--muted-foreground)]"
            }`}
          >
            Problem
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("submissions")}
            className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${
              mobileTab === "submissions"
                ? "bg-[var(--accent)] text-[var(--foreground)] font-semibold"
                : "text-[var(--muted-foreground)]"
            }`}
          >
            Submissions
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("code")}
            className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${
              mobileTab === "code"
                ? "bg-[var(--accent)] text-[var(--foreground)] font-semibold"
                : "text-[var(--muted-foreground)]"
            }`}
          >
            Code
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("output")}
            className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${
              mobileTab === "output"
                ? "bg-[var(--accent)] text-[var(--foreground)] font-semibold"
                : "text-[var(--muted-foreground)]"
            }`}
          >
            Output {isExecuting && <Loader2 className="inline ml-1 w-3 h-3 animate-spin text-[var(--brand)]" />}
          </button>
        </div>

        {/* Mobile action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleExecute("run")}
            disabled={isExecuting}
            className="px-2.5 py-1 rounded border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-xs font-medium cursor-pointer disabled:opacity-50"
          >
            Run
          </button>
          <button
            type="button"
            onClick={() => handleExecute("submit")}
            disabled={isExecuting}
            className="px-2.5 py-1 rounded bg-[var(--brand)] text-[var(--brand-foreground)] text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      </div>

      {/* Desktop Workspace Split (lg and up) */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" autoSaveId="code0_problem_split_h">
          {/* Left Panel: Problem Statement & Submissions */}
          <ResizablePanel defaultSize={42} minSize={25} maxSize={65}>
            <div className="h-full border-r border-[var(--border)] bg-[var(--card)] flex flex-col overflow-hidden">
              {/* Left Panel Tabs Header */}
              <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--border)] bg-[var(--card)] shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveLeftTab("description")}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeLeftTab === "description"
                      ? "bg-[var(--muted)] text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Description</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveLeftTab("submissions")}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeLeftTab === "submissions"
                      ? "bg-[var(--muted)] text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Submissions</span>
                </button>
              </div>

              {/* Left Panel Tab Content */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {activeLeftTab === "description" ? (
                  <ProblemDescription data={problemData} />
                ) : (
                  <ProblemSubmissions
                    problemId={problemData.problem.id}
                    user={currentUser ?? null}
                    refreshTrigger={submissionsRefreshTrigger}
                    onLoadCode={handleLoadPastCode}
                  />
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel: Editor over Testcase/Result */}
          <ResizablePanel defaultSize={58} minSize={35}>
            <ResizablePanelGroup direction="vertical" autoSaveId="code0_problem_split_v">
              {/* Top: Editor Toolbar + Monaco Editor */}
              <ResizablePanel defaultSize={65} minSize={30}>
                <div className="flex flex-col h-full overflow-hidden bg-[var(--background)]">
                  {/* Editor Toolbar */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--card)] shrink-0">
                    {/* Left: Language Select */}
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <select
                          value={language}
                          onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
                          className="h-8 pl-8 pr-7 rounded-md border border-[var(--border)] bg-[var(--background)] text-xs font-medium text-[var(--foreground)] appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                        >
                          {SUPPORTED_LANGUAGES.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name} ({l.version})
                            </option>
                          ))}
                        </select>
                        <Image
                          src={currentLangObj.icon}
                          alt={currentLangObj.name}
                          width={16}
                          height={16}
                          className="absolute left-2.5 top-2 w-4 h-4 object-contain pointer-events-none"
                        />
                        <ChevronDown className="absolute right-2 top-2.5 w-3.5 h-3.5 text-[var(--muted-foreground)] pointer-events-none" />
                      </div>

                      <button
                        type="button"
                        onClick={handleResetCode}
                        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                        title="Reset code to initial template"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </button>
                    </div>

                    {/* Right: Run & Submit Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleExecute("run")}
                        disabled={isExecuting}
                        className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-xs font-semibold text-[var(--foreground)] transition-colors cursor-pointer disabled:opacity-50"
                        title="Run against sample or custom test cases"
                      >
                        {isExecuting && execMode === "run" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--brand)]" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500" />
                        )}
                        <span>Run</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExecute("submit")}
                        disabled={isExecuting}
                        className="inline-flex items-center gap-1.5 h-8 px-4 rounded-md bg-[var(--brand)] text-[var(--brand-foreground)] text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 shadow-xs"
                        title="Submit code for evaluation against all hidden test cases"
                      >
                        {isExecuting && execMode === "submit" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>Submit</span>
                      </button>
                    </div>
                  </div>

                  {/* Monaco Editor Container */}
                  <div className="flex-1 overflow-hidden">
                    <MonacoCodeEditor
                      code={code}
                      onChange={handleCodeChange}
                      language={currentLangObj.monacoLang}
                    />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Bottom: Testcase & Result Panel */}
              <ResizablePanel
                ref={bottomPanelRef}
                defaultSize={38}
                minSize={15}
                collapsible
                collapsedSize={0}
                onCollapse={() => setBottomPanelCollapsed(true)}
                onExpand={() => setBottomPanelCollapsed(false)}
              >
                <div className="flex flex-col h-full bg-[var(--card)] border-t border-[var(--border)] overflow-hidden">
                  {/* Bottom Header Bar */}
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)] bg-[var(--muted)]/20 shrink-0">
                    <div className="flex items-center gap-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setActiveBottomTab("testcases")}
                        className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                          activeBottomTab === "testcases"
                            ? "bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] shadow-xs"
                            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        Test Cases
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveBottomTab("result")}
                        className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 ${
                          activeBottomTab === "result"
                            ? "bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] shadow-xs"
                            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <span>Result</span>
                        {isExecuting && <Loader2 className="w-3 h-3 animate-spin text-[var(--brand)]" />}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={toggleBottomPanel}
                      className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                      title={bottomPanelCollapsed ? "Expand testcase panel" : "Collapse testcase panel"}
                    >
                      {bottomPanelCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Panel Body */}
                  <div className="flex-1 overflow-hidden">
                    {activeBottomTab === "testcases" ? (
                      <TestcasePanel
                        data={problemData}
                        customInput={customInput}
                        onCustomInputChange={setCustomInput}
                        activeTab={activeTestcaseTab}
                        onTabChange={setActiveTestcaseTab}
                      />
                    ) : (
                      <ResultPanel
                        result={execResult}
                        status={execStatus}
                        mode={execMode}
                      />
                    )}
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile Stacked View (< lg) */}
      <div className="lg:hidden flex-1 overflow-hidden flex flex-col">
        {mobileTab === "problem" && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--card)]">
            <ProblemDescription data={problemData} />
          </div>
        )}

        {mobileTab === "submissions" && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--card)]">
            <ProblemSubmissions
              problemId={problemData.problem.id}
              user={currentUser ?? null}
              refreshTrigger={submissionsRefreshTrigger}
              onLoadCode={handleLoadPastCode}
            />
          </div>
        )}

        {mobileTab === "code" && (
          <div className="flex-1 flex flex-col overflow-hidden bg-[var(--background)]">
            {/* Mobile language select bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--card)]">
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
                className="h-7 px-2 rounded border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)]"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleResetCode}
                className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                Reset code
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <MonacoCodeEditor
                code={code}
                onChange={handleCodeChange}
                language={currentLangObj.monacoLang}
              />
            </div>
          </div>
        )}

        {mobileTab === "output" && (
          <div className="flex-1 flex flex-col overflow-hidden bg-[var(--card)]">
            <div className="flex items-center gap-2 p-2 border-b border-[var(--border)] bg-[var(--muted)]/20 text-xs">
              <button
                type="button"
                onClick={() => setActiveBottomTab("testcases")}
                className={`px-2.5 py-1 rounded ${
                  activeBottomTab === "testcases" ? "bg-[var(--card)] font-medium border" : "text-[var(--muted-foreground)]"
                }`}
              >
                Test Cases
              </button>
              <button
                type="button"
                onClick={() => setActiveBottomTab("result")}
                className={`px-2.5 py-1 rounded ${
                  activeBottomTab === "result" ? "bg-[var(--card)] font-medium border" : "text-[var(--muted-foreground)]"
                }`}
              >
                Result
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {activeBottomTab === "testcases" ? (
                <TestcasePanel
                  data={problemData}
                  customInput={customInput}
                  onCustomInputChange={setCustomInput}
                  activeTab={activeTestcaseTab}
                  onTabChange={setActiveTestcaseTab}
                />
              ) : (
                <ResultPanel
                  result={execResult}
                  status={execStatus}
                  mode={execMode}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Guest Login Guard Modal */}
      <GuestLoginModal
        isOpen={guestModalOpen}
        onClose={() => setGuestModalOpen(false)}
        actionType={guestActionType}
        problemId={problemId}
      />
    </div>
  );
}
