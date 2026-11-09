"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ArrowRight, UserPlus, UserMinus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registerContestAction, unregisterContestAction } from "../../_components/actions";
import type { ContestStatus } from "@/types/contest";

interface ContestRegisterButtonProps {
  contestId: number;
  status: ContestStatus;
  isRegistered: boolean;
  isLoggedIn: boolean;
}

export function ContestRegisterButton({
  contestId,
  status,
  isRegistered,
  isLoggedIn,
}: ContestRegisterButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If user is not logged in, prompt to log in with next redirect
  if (!isLoggedIn) {
    return (
      <Link href={`/login?next=/contests/${contestId}`}>
        <Button size="lg" className="gap-2 cursor-pointer">
          <UserPlus className="h-4 w-4" />
          Log in to Register
        </Button>
      </Link>
    );
  }

  // Handle Register
  const handleRegister = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await registerContestAction(contestId);
      if (res.success) {
        router.refresh();
      } else {
        setErrorMessage(res.error || "Failed to register.");
      }
    });
  };

  // Handle Unregister
  const handleUnregister = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await unregisterContestAction(contestId);
      if (res.success) {
        router.refresh();
      } else {
        setErrorMessage(res.error || "Failed to unregister.");
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-2">
      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-950/30 border border-red-900/60 rounded px-2.5 py-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isRegistered ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            Registered
          </div>

          {status === "live" && (
            <Link href={`/contests/${contestId}/arena`}>
              <Button size="lg" className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer font-semibold shadow-md">
                Enter Arena
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}

          {status === "upcoming" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnregister}
              isLoading={isPending}
              className="text-xs text-[var(--muted-foreground)] hover:text-red-400 hover:border-red-800 cursor-pointer"
            >
              <UserMinus className="h-3.5 w-3.5 mr-1" />
              Unregister
            </Button>
          )}
        </div>
      ) : status === "ended" ? (
        <div className="text-xs text-[var(--muted-foreground)] italic">
          This contest has ended. Registration is closed.
        </div>
      ) : (
        <Button
          size="lg"
          onClick={handleRegister}
          isLoading={isPending}
          className="gap-2 cursor-pointer font-semibold"
        >
          <UserPlus className="h-4 w-4" />
          Register for Contest
        </Button>
      )}
    </div>
  );
}

