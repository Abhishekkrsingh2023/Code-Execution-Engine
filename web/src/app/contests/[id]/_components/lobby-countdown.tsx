"use client";

import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { CountdownTimer } from "../../_components/countdown-timer";
import type { ContestStatus } from "@/types/contest";

interface LobbyCountdownProps {
  status: ContestStatus;
  startTime: string;
  endTime: string;
  serverTime: string;
}

export function LobbyCountdown({
  status,
  startTime,
  endTime,
  serverTime,
}: LobbyCountdownProps) {
  const router = useRouter();

  if (status === "ended") {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <Clock className="h-4 w-4" />
        <span>Contest has concluded</span>
      </div>
    );
  }

  const isLive = status === "live";
  const targetTime = isLive ? endTime : startTime;
  const label = isLive ? "Contest Ends In" : "Contest Starts In";

  return (
    <div className="flex flex-col gap-1 p-4 rounded-lg bg-[var(--accent)]/50 border border-[var(--border)]">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
        <Clock className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className="text-2xl sm:text-3xl font-extrabold text-[var(--foreground)]">
        <CountdownTimer
          targetTime={targetTime}
          serverTime={serverTime}
          onComplete={() => {
            // State flip: refresh page automatically when countdown hits zero
            router.refresh();
          }}
          className={isLive ? "text-emerald-400" : "text-amber-400"}
        />
      </div>
    </div>
  );
}

