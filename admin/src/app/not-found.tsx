import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-zinc-950 text-zinc-100">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 mb-4">
        <FileQuestion className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-bold tracking-tight text-zinc-100">
        404 — Page Not Found
      </h1>
      <p className="text-xs text-zinc-400 max-w-sm mt-2 mb-6">
        The requested resource, problem, user, or log record does not exist or has been removed.
      </p>
      <Link href="/">
        <Button variant="outline" size="sm">
          <ArrowLeft className="h-3.5 w-3.5 mr-2" />
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}

