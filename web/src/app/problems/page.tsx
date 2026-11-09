import Link from "next/link";
import { Suspense } from "react";
import { listProblems } from "@/lib/api/problems";
import { ProblemFilters } from "./_components/problem-filters";
import { DifficultyBadge } from "@/components/shared/difficulty-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Footer } from "@/components/shared/footer";
import { ChevronLeft, ChevronRight, FileQuestion } from "lucide-react";

interface ProblemsPageProps {
  searchParams: Promise<{
    page?: string;
    difficulty?: string;
    topic?: string;
    search?: string;
  }>;
}

const PAGE_SIZE = 15;

export default async function ProblemsPage({ searchParams }: ProblemsPageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  let problemsData = { total: 0, skip: 0, limit: PAGE_SIZE, problems: [] as import("@/types/problem").ProblemResponse[] };
  let errorMsg = "";

  try {
    problemsData = await listProblems({
      skip,
      limit: PAGE_SIZE,
      difficulty: params.difficulty,
      topic: params.topic,
      search: params.search,
    });
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "Failed to load problems.";
  }

  const { total, problems } = problemsData;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  const createPageUrl = (targetPage: number) => {
    const q = new URLSearchParams();
    if (targetPage > 1) q.set("page", String(targetPage));
    if (params.difficulty) q.set("difficulty", params.difficulty);
    if (params.topic) q.set("topic", params.topic);
    if (params.search) q.set("search", params.search);
    const qs = q.toString();
    return `/problems${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex-1 flex flex-col justify-between overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Problem Archive
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Browse and solve algorithmic challenges across data structures, math, and systems.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-[var(--muted-foreground)] border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 rounded-md font-mono">
          <span>Total Problems:</span>
          <span className="font-bold text-[var(--foreground)]">{total}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Suspense fallback={<div className="h-16 rounded-md bg-[var(--card)] animate-pulse mb-6" />}>
        <ProblemFilters />
      </Suspense>

      {/* Error state */}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-md border border-[var(--hard-border)] bg-[var(--hard-bg)] text-[var(--hard)] text-xs">
          <p className="font-semibold">Unable to load problem catalog</p>
          <p className="mt-1">{errorMsg}</p>
        </div>
      )}

      {/* Table Container */}
      {!errorMsg && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-xs">
          {problems.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<FileQuestion className="w-8 h-8 text-[var(--muted-foreground)]" />}
                title="No problems found"
                description={
                  params.search || params.difficulty || params.topic
                    ? "Try adjusting your filters or search keywords to find problems."
                    : "There are currently no active problems in the system archive."
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--border)] bg-[var(--muted)]/40 text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">
                  <tr>
                    <th scope="col" className="w-16 px-4 py-3">#</th>
                    <th scope="col" className="px-4 py-3">Title</th>
                    <th scope="col" className="w-28 px-4 py-3">Difficulty</th>
                    <th scope="col" className="w-36 px-4 py-3">Topic</th>
                    <th scope="col" className="w-32 px-4 py-3 text-right">Limits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {problems.map((problem) => (
                    <tr
                      key={problem.id}
                      className="hover:bg-[var(--accent)]/50 transition-colors group"
                    >
                      <td className="px-4 py-3 font-mono text-[var(--muted-foreground)]">
                        {problem.id}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/problems/${problem.id}`}
                          className="font-medium text-[var(--foreground)] group-hover:text-[var(--brand)] transition-colors inline-block"
                        >
                          {problem.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <DifficultyBadge difficulty={problem.difficulty} />
                      </td>
                      <td className="px-4 py-3 text-[var(--muted-foreground)]">
                        {problem.topic || "General"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--muted-foreground)]">
                        {problem.time_limit}s / {problem.memory_limit}MB
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--muted)]/20 text-xs">
              <span className="text-[var(--muted-foreground)]">
                Showing {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
              </span>

              <div className="flex items-center gap-1">
                {page > 1 ? (
                  <Link
                    href={createPageUrl(page - 1)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-[var(--foreground)] transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[var(--border)] opacity-40 cursor-not-allowed">
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </span>
                )}

                <span className="px-3 py-1 font-mono text-[var(--muted-foreground)]">
                  {page} / {totalPages}
                </span>

                {page < totalPages ? (
                  <Link
                    href={createPageUrl(page + 1)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-[var(--foreground)] transition-colors"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[var(--border)] opacity-40 cursor-not-allowed">
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      <Footer />
    </div>
  );
}

