"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X, Loader2 } from "lucide-react";

export function ProblemFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get("search") || "";
  const currentDifficulty = searchParams.get("difficulty") || "";
  const currentTopic = searchParams.get("topic") || "";

  const [search, setSearch] = useState(currentSearch);
  const [topic, setTopic] = useState(currentTopic);

  const applyFilters = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page"); // reset page on filter change

    for (const [key, val] of Object.entries(newParams)) {
      if (val) {
        params.set(key, val);
      } else {
        params.delete(key);
      }
    }

    startTransition(() => {
      router.push(`/problems?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters({ search: search.trim(), topic: topic.trim() });
  };

  const handleDifficultyClick = (diff: string) => {
    const nextDiff = currentDifficulty === diff ? null : diff;
    applyFilters({ difficulty: nextDiff });
  };

  const handleClear = () => {
    setSearch("");
    setTopic("");
    startTransition(() => {
      router.push("/problems");
    });
  };

  const hasFilters = Boolean(currentSearch || currentDifficulty || currentTopic);

  return (
    <div className="space-y-3 mb-6">
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        {/* Search input form */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search problems by title, topic..."
            className="w-full h-9 pl-9 pr-8 rounded-md border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                applyFilters({ search: null });
              }}
              className="absolute right-2.5 top-2.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {/* Topic filter */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyFilters({ topic: topic.trim() });
              }
            }}
            placeholder="Filter by topic (e.g. array)"
            className="h-9 px-3 w-44 rounded-md border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />

          {hasFilters && (
            <button
              type="button"
              onClick={handleClear}
              className="h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1 cursor-pointer"
              title="Reset all filters"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}

          {isPending && <Loader2 className="w-4 h-4 text-[var(--muted-foreground)] animate-spin" />}
        </div>
      </div>

      {/* Difficulty pills */}
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-[var(--muted-foreground)] font-medium mr-1">Difficulty:</span>
        {[
          { label: "All", value: "" },
          { label: "Easy", value: "easy" },
          { label: "Medium", value: "medium" },
          { label: "Hard", value: "hard" },
        ].map((item) => {
          const isActive = currentDifficulty === item.value;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => handleDifficultyClick(item.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
                isActive
                  ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                  : "bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] border-[var(--border)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

