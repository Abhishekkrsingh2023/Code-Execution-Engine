import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-950/60 border border-red-800 text-red-400 mb-4">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-bold tracking-tight text-zinc-100">
        403 — Access Denied
      </h1>
      <p className="text-xs text-zinc-400 max-w-md mt-2 mb-6">
        Your current staff role does not have permission to access this administrative resource.
        This section is restricted to administrators only.
      </p>
      <Link href="/">
        <Button variant="outline" size="sm">
          <ArrowLeft className="h-3.5 w-3.5 mr-2" />
          Back to Overview
        </Button>
      </Link>
    </div>
  );
}

