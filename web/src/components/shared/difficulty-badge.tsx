import { cn } from "@/lib/utils";
import type { ProblemDifficulty } from "@/types/problem";

interface DifficultyBadgeProps {
  difficulty: ProblemDifficulty | string;
  className?: string;
}

export function DifficultyBadge({ difficulty, className }: DifficultyBadgeProps) {
  const diff = (difficulty || "easy").toLowerCase();

  const styles: Record<string, string> = {
    easy: "text-[var(--easy)] bg-[var(--easy-bg)] border-[var(--easy-border)]",
    medium: "text-[var(--medium)] bg-[var(--medium-bg)] border-[var(--medium-border)]",
    hard: "text-[var(--hard)] bg-[var(--hard-bg)] border-[var(--hard-border)]",
  };

  const label = diff.charAt(0).toUpperCase() + diff.slice(1);

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize",
        styles[diff] || "text-[var(--muted-foreground)] bg-[var(--muted)] border-[var(--border)]",
        className
      )}
    >
      {label}
    </span>
  );
}

