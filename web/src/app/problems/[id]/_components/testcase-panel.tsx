"use client";

import { useState } from "react";
import type { FullProblemResponse } from "@/types/problem";

interface TestcasePanelProps {
  data: FullProblemResponse;
  customInput: string;
  onCustomInputChange: (val: string) => void;
  activeTab: "sample" | "custom";
  onTabChange: (tab: "sample" | "custom") => void;
}

export function TestcasePanel({
  data,
  customInput,
  onCustomInputChange,
  activeTab,
  onTabChange,
}: TestcasePanelProps) {
  const [selectedCaseIdx, setSelectedCaseIdx] = useState(0);
  const sampleCases = data.run_test_cases || [];
  const currentCase = sampleCases[selectedCaseIdx];

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--border)] bg-[var(--muted)]/30 shrink-0">
        <button
          type="button"
          onClick={() => onTabChange("sample")}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
            activeTab === "sample"
              ? "bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] shadow-xs"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          Sample Cases ({sampleCases.length})
        </button>
        <button
          type="button"
          onClick={() => onTabChange("custom")}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
            activeTab === "custom"
              ? "bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] shadow-xs"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          Custom Input (Run Only)
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "sample" ? (
          sampleCases.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-[var(--muted-foreground)]">
              No sample test cases configured for this problem.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Case selector pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {sampleCases.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedCaseIdx(idx)}
                    className={`px-2 py-0.5 rounded text-xs font-mono font-medium border transition-colors cursor-pointer ${
                      selectedCaseIdx === idx
                        ? "bg-[var(--brand)] text-[var(--brand-foreground)] border-transparent"
                        : "bg-[var(--card)] text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    Case {idx + 1}
                  </button>
                ))}
              </div>

              {/* Selected case details */}
              {currentCase && (
                <div className="space-y-2.5 font-mono text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-sans font-medium text-[var(--muted-foreground)] block mb-1">
                      Input:
                    </span>
                    <pre className="p-2 rounded border border-[var(--border)] bg-[var(--background)] whitespace-pre-wrap break-all">
                      {currentCase.input || "<empty>"}
                    </pre>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-sans font-medium text-[var(--muted-foreground)] block mb-1">
                      Expected Output:
                    </span>
                    <pre className="p-2 rounded border border-[var(--border)] bg-[var(--background)] whitespace-pre-wrap break-all">
                      {currentCase.expected_output || "<empty>"}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="h-full flex flex-col space-y-2">
            <span className="text-[10px] uppercase font-sans font-medium text-[var(--muted-foreground)]">
              Standard Input (stdin):
            </span>
            <textarea
              value={customInput}
              onChange={(e) => onCustomInputChange(e.target.value)}
              placeholder="Enter custom input data here for Run..."
              className="flex-1 w-full p-2.5 font-mono text-xs rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] resize-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}

