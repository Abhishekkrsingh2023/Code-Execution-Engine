import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DifficultyBadge } from "@/components/shared/difficulty-badge";
import type { FullProblemResponse } from "@/types/problem";
import { Clock, HardDrive, Tag } from "lucide-react";

interface ProblemDescriptionProps {
  data: FullProblemResponse;
}

export function ProblemDescription({ data }: ProblemDescriptionProps) {
  const { problem, run_test_cases } = data;

  return (
    <div className="h-full overflow-y-auto p-5 text-xs sm:text-sm text-[var(--foreground)] leading-relaxed space-y-6">
      {/* Title & Metadata */}
      <div className="border-b border-[var(--border)] pb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-[var(--muted-foreground)]">
            Problem #{problem.id}
          </span>
          <DifficultyBadge difficulty={problem.difficulty} />
          {problem.topic && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-[var(--border)] bg-[var(--muted)]/50 text-[var(--muted-foreground)]">
              <Tag className="w-3 h-3" />
              <span>{problem.topic}</span>
            </span>
          )}
        </div>

        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--foreground)]">
          {problem.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[var(--muted-foreground)] pt-1">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Time Limit: {problem.time_limit}s</span>
          </div>
          <div className="flex items-center gap-1">
            <HardDrive className="w-3.5 h-3.5" />
            <span>Memory Limit: {problem.memory_limit}MB</span>
          </div>
        </div>
      </div>

      {/* Description Statement */}
      <div className="prose prose-sm dark:prose-invert max-w-none space-y-3 text-[var(--foreground)]">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ ...props }) => <h2 className="text-base font-bold mt-4 mb-2 text-[var(--foreground)]" {...props} />,
            h2: ({ ...props }) => <h3 className="text-sm font-semibold mt-3 mb-1.5 text-[var(--foreground)]" {...props} />,
            h3: ({ ...props }) => <h4 className="text-xs font-semibold mt-2 mb-1 text-[var(--foreground)]" {...props} />,
            p: ({ ...props }) => <p className="text-xs sm:text-sm text-[var(--foreground)]/90 leading-relaxed mb-3" {...props} />,
            ul: ({ ...props }) => <ul className="list-disc pl-5 space-y-1 text-xs mb-3" {...props} />,
            ol: ({ ...props }) => <ol className="list-decimal pl-5 space-y-1 text-xs mb-3" {...props} />,
            li: ({ ...props }) => <li className="text-xs text-[var(--foreground)]/90" {...props} />,
            code: ({ className, children, ...props }) => {
              const isInline = !className && typeof children === "string" && !children.includes("\n");
              if (isInline) {
                return (
                  <code
                    className="px-1.5 py-0.5 rounded font-mono text-[11px] bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)]"
                    {...props}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <div className="my-2 rounded-md border border-[var(--border)] bg-[var(--card)] p-3 overflow-x-auto">
                  <code className="font-mono text-xs text-[var(--foreground)]" {...props}>
                    {children}
                  </code>
                </div>
              );
            },
            pre: ({ children }) => <div>{children}</div>,
          }}
        >
          {problem.description}
        </ReactMarkdown>
      </div>

      {/* Sample Cases */}
      {run_test_cases && run_test_cases.length > 0 && (
        <div className="border-t border-[var(--border)] pt-4 space-y-4">
          <h2 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
            Sample Test Cases
          </h2>
          <div className="space-y-3">
            {run_test_cases.map((tc, index) => (
              <div
                key={tc.id ?? index}
                className="rounded-md border border-[var(--border)] bg-[var(--card)]/60 overflow-hidden"
              >
                <div className="px-3 py-1.5 border-b border-[var(--border)] bg-[var(--muted)]/40 text-[11px] font-mono text-[var(--muted-foreground)]">
                  Example {index + 1}
                </div>
                <div className="p-3 space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-[var(--muted-foreground)] block text-[10px] uppercase font-sans mb-0.5">
                      Input:
                    </span>
                    <pre className="p-2 rounded bg-[var(--background)] border border-[var(--border)] whitespace-pre-wrap break-all">
                      {tc.input || "<empty>"}
                    </pre>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)] block text-[10px] uppercase font-sans mb-0.5">
                      Expected Output:
                    </span>
                    <pre className="p-2 rounded bg-[var(--background)] border border-[var(--border)] whitespace-pre-wrap break-all">
                      {tc.expected_output || "<empty>"}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
