"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { Trophy, LogOut, Check, Clock, AlertCircle } from "lucide-react";
import { CountdownTimer } from "../../../_components/countdown-timer";
import { Button } from "@/components/ui/button";
import type { ContestProblem } from "@/types/contest";

interface ProblemAttemptState {
  is_solved: boolean;
  attempts: number;
}

interface ContestArenaTopbarProps {
  title: string;
  contestId: number;
  problems: ContestProblem[];
  activeProblemIndex: number;
  onSelectProblem: (index: number) => void;
  endTime: string;
  serverTime: string;
  onContestEnd?: () => void;
  onOpenLeaderboard: () => void;
  problemStates?: Record<number, ProblemAttemptState>;
}

export function ContestArenaTopbar({
  title,
  contestId,
  problems,
  activeProblemIndex,
  onSelectProblem,
  endTime,
  serverTime,
  onContestEnd,
  onOpenLeaderboard,
  problemStates = {},
}: ContestArenaTopbarProps) {
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIdx = (index + 1) % problems.length;
      onSelectProblem(nextIdx);
      tabsRef.current[nextIdx]?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIdx = (index - 1 + problems.length) % problems.length;
      onSelectProblem(prevIdx);
      tabsRef.current[prevIdx]?.focus();
    }
  };

  return (
    <header className="h-12 w-full border-b border-[var(--border)] bg-[var(--background)] px-3 sm:px-4 flex items-center justify-between gap-3 shrink-0 select-none z-20">
      {/* Left: Title & Problems Tablist */}
      <div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold text-xs uppercase tracking-wider text-[var(--foreground)] truncate max-w-[140px] sm:max-w-[200px]">
            {title}
          </span>
          <span className="text-[var(--border)] hidden sm:inline">|</span>
        </div>

        {/* Horizontally scrollable problem tabs, non-wrapping */}
        <div
          role="tablist"
          aria-label="Contest Problems"
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 min-w-0"
        >
          {problems.map((prob, idx) => {
            const isActive = idx === activeProblemIndex;
            const state = problemStates[prob.problem_id];
            const isSolved = state?.is_solved;
            const attempts = state?.attempts || 0;

            return (
              <button
                key={prob.id}
                ref={(el) => {
                  tabsRef.current[idx] = el;
                }}
                role="tab"
                id={`arena-tab-p${prob.position}`}
                aria-selected={isActive}
                aria-controls={`arena-panel-p${prob.position}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onSelectProblem(idx)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 border ${
                  isActive
                    ? "bg-[var(--accent)] text-[var(--foreground)] border-[var(--border)] shadow-xs"
                    : "text-[var(--muted-foreground)] border-transparent hover:bg-[var(--accent)]/50 hover:text-[var(--foreground)]"
                }`}
              >
                <span>P{prob.position}</span>

                {isSolved ? (
                  <span
                    className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400"
                    title="Solved"
                  >
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </span>
                ) : attempts > 0 ? (
                  <span
                    className="flex h-3.5 min-w-3.5 px-1 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-mono"
                    title={`${attempts} attempt${attempts > 1 ? "s" : ""}`}
                  >
                    {attempts}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Timer, Leaderboard, Exit */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded text-xs font-mono text-emerald-400">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <CountdownTimer
            targetTime={endTime}
            serverTime={serverTime}
            onComplete={onContestEnd}
            className="text-emerald-400 text-xs"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenLeaderboard}
          className="h-8 gap-1.5 text-xs text-[var(--foreground)] cursor-pointer"
          title="Open Standings"
        >
          <Trophy className="h-3.5 w-3.5 text-amber-500" />
          <span className="hidden sm:inline">Leaderboard</span>
        </Button>

        <Link href={`/contests/${contestId}`}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs text-[var(--muted-foreground)] hover:text-red-400 cursor-pointer"
            title="Exit Arena back to lobby"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Exit</span>
          </Button>
        </Link>
      </div>
    </header>
  );
}

