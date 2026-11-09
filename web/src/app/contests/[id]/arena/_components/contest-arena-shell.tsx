"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ContestArenaTopbar } from "./contest-arena-topbar";
import { ContestLeaderboardModal } from "./contest-leaderboard-modal";
import { WorkspaceShell } from "@/app/problems/[id]/_components/workspace-shell";
import type { ContestResponse, ContestLeaderboardEntry } from "@/types/contest";
import type { FullProblemResponse } from "@/types/problem";
import type { UserResponse } from "@/types/user";

interface ContestArenaShellProps {
  contest: ContestResponse;
  problemMap: Record<number, FullProblemResponse>;
  user: UserResponse;
  initialRank?: ContestLeaderboardEntry | null;
}

export function ContestArenaShell({
  contest,
  problemMap,
  user,
  initialRank,
}: ContestArenaShellProps) {
  const router = useRouter();
  const [activeProblemIndex, setActiveProblemIndex] = useState(0);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [myRank, setMyRank] = useState<ContestLeaderboardEntry | null>(
    initialRank || null
  );

  // Map of problem_id -> { is_solved, attempts }
  const problemStates: Record<number, { is_solved: boolean; attempts: number }> = {};
  if (myRank?.problems && Array.isArray(myRank.problems)) {
    for (const p of myRank.problems) {
      problemStates[p.problem_id] = {
        is_solved: p.is_solved,
        attempts: p.attempts,
      };
    }
  } else if (myRank?.problem_scores) {
    for (const [pid, p] of Object.entries(myRank.problem_scores)) {
      problemStates[Number(pid)] = {
        is_solved: p.is_solved,
        attempts: p.attempts,
      };
    }
  }

  // Refresh user's rank & problem verdicts
  const refreshMyRank = useCallback(async () => {
    try {
      const res = await fetch(`/api-v1/contests/${contest.id}/leaderboard/me`);
      if (res.ok) {
        const data = (await res.json()) as ContestLeaderboardEntry;
        setMyRank(data);
      }
    } catch {
      // non-critical
    }
  }, [contest.id]);

  const handleContestEnd = useCallback(() => {
    alert("Contest has ended! The arena is now closed.");
    router.push(`/contests/${contest.id}`);
  }, [contest.id, router]);

  const activeProblem = contest.problems[activeProblemIndex];
  const activeProblemData = activeProblem
    ? problemMap[activeProblem.problem_id]
    : null;

  return (
    <div className="fixed inset-0 z-50 h-[100dvh] w-screen bg-[var(--background)] flex flex-col overflow-hidden">
      {/* Slim Top Bar */}
      <ContestArenaTopbar
        title={contest.title}
        contestId={contest.id}
        problems={contest.problems}
        activeProblemIndex={activeProblemIndex}
        onSelectProblem={setActiveProblemIndex}
        endTime={contest.end_time}
        serverTime={contest.server_time}
        onContestEnd={handleContestEnd}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        problemStates={problemStates}
      />

      {/* Main Two-Pane Problem Workspace */}
      <main
        id={`arena-panel-p${activeProblem?.position || 1}`}
        role="tabpanel"
        aria-labelledby={`arena-tab-p${activeProblem?.position || 1}`}
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
      >
        {activeProblemData ? (
          <WorkspaceShell
            key={activeProblem.problem_id}
            problemData={activeProblemData}
            isAuthenticated={true}
            currentUser={user}
            problemId={activeProblem.problem_id}
            contestId={contest.id}
            onSubmissionComplete={refreshMyRank}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-xs text-[var(--muted-foreground)]">
            Loading problem statement...
          </div>
        )}
      </main>

      {/* Leaderboard Modal */}
      <ContestLeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        contestId={contest.id}
        currentUsername={user.username}
      />
    </div>
  );
}

