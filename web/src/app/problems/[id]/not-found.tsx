import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";

export default function ProblemNotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="flex items-center justify-center w-12 h-12 rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] mb-4">
        <FileQuestion className="w-6 h-6" />
      </div>
      <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
        Problem Not Found
      </h1>
      <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)] max-w-sm">
        The algorithmic problem you are trying to access does not exist, has an invalid identifier, or was removed.
      </p>
      <div className="mt-6">
        <Link
          href="/problems"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--brand)] text-[var(--brand-foreground)] text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Problems</span>
        </Link>
      </div>
    </div>
  );
}

