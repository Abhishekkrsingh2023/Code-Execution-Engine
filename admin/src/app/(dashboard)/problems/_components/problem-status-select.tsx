"use client";

import { useTransition, useState } from "react";
import { updateProblemStatusAction } from "./actions";
import type { ProblemStatus } from "@/types/problem";

interface ProblemStatusSelectProps {
  problemId: number;
  initialStatus: ProblemStatus;
}

export function ProblemStatusSelect({
  problemId,
  initialStatus,
}: ProblemStatusSelectProps) {
  const [status, setStatus] = useState<ProblemStatus>(initialStatus);
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextStatus = e.target.value as ProblemStatus;
    setStatus(nextStatus);
    startTransition(async () => {
      const res = await updateProblemStatusAction(problemId, nextStatus);
      if (!res.success) {
        setStatus(initialStatus); // Revert on failure
        alert(res.error || "Failed to update status");
      }
    });
  };

  return (
    <select
      value={status}
      onChange={handleChange}
      disabled={isPending}
      aria-label="Change problem status"
      className="h-7 rounded border border-zinc-700 bg-zinc-900 px-2 text-[11px] font-medium text-zinc-200 transition-colors hover:border-zinc-600 focus:outline-hidden focus:ring-1 focus:ring-zinc-400 disabled:opacity-50 cursor-pointer"
    >
      <option value="published">Published</option>
      <option value="draft">Draft</option>
      <option value="unpublished">Unpublished</option>
      <option value="archived">Archived</option>
    </select>
  );
}

