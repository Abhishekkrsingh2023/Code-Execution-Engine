import React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)]/50",
        className
      )}
    >
      {icon && <div className="mb-3 text-[var(--muted-foreground)]">{icon}</div>}
      <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      {description && (
        <p className="mt-1 text-xs text-[var(--muted-foreground)] max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

