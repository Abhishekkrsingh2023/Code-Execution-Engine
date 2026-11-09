import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy, ArrowLeft, Clock, Users, CheckCircle2, XCircle } from "lucide-react";
import { getContest, getContestLeaderboard } from "@/lib/api/contests";
import { getCurrentUser } from "@/lib/auth/session";
import { ContestStatusBadge } from "../../_components/contest-status-badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface ContestLeaderboardPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ContestLeaderboardPage({
  params,
}: ContestLeaderboardPageProps) {
  const resolvedParams = await params;
  const contestId = parseInt(resolvedParams.id, 10);
  if (isNaN(contestId)) {
    notFound();
  }

  let contest;
  try {
    contest = await getContest(contestId);
  } catch {
    notFound();
  }

  // Contest leaderboard can only be viewed once the contest starts (live or ended)
  if (contest.status === "upcoming") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <Trophy className="h-10 w-10 text-amber-500 mx-auto opacity-50" />
        <h1 className="text-xl font-bold text-[var(--foreground)]">
          Contest has not started yet
        </h1>
        <p className="text-xs text-[var(--muted-foreground)]">
          Leaderboard and standings will become active once the contest begins.
        </p>
        <Link href={`/contests/${contest.id}`}>
          <Button variant="outline" size="sm" className="mt-4 gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Contest Lobby
          </Button>
        </Link>
      </div>
    );
  }

  const currentUser = await getCurrentUser();
  let leaderboard = null;
  try {
    leaderboard = await getContestLeaderboard(contestId, { limit: 100 });
  } catch {
    // Non-critical
  }

  const leaderboardEntries = leaderboard?.entries ?? leaderboard?.leaderboard ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/contests/${contest.id}`}
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Contest Lobby
            </Link>
            <span className="text-[var(--border)]">•</span>
            <ContestStatusBadge status={contest.status} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--foreground)]">
            {contest.title} — Standings
          </h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            Ranked according to standard ICPC scoring: solved count desc, penalty time asc.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)] shrink-0">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {leaderboard ? leaderboard.total_participants : 0} competitors
          </span>
          <span>•</span>
          <span>+{contest.penalty_minutes}m wrong penalty</span>
        </div>
      </div>

      {/* Standings Table */}
      {leaderboardEntries.length === 0 ? (
        <div className="p-12 text-center text-xs text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-xl">
          No ranked participants or submissions recorded yet.
        </div>
      ) : (
        <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--card)] shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--accent)]/50 border-b border-[var(--border)] text-left font-semibold text-[var(--muted-foreground)]">
                  <th className="py-3 px-4 w-16 text-center">Rank</th>
                  <th className="py-3 px-4 min-w-[160px]">Competitor</th>
                  <th className="py-3 px-3 w-20 text-center">Solved</th>
                  <th className="py-3 px-3 w-28 text-right">Penalty</th>
                  <th className="py-3 px-3 w-24 text-right">Score</th>
                  {contest.problems.map((p) => (
                    <th key={p.id} className="py-3 px-3 text-center min-w-[70px]">
                      P{p.position}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {leaderboardEntries.map((entry) => {
                  const isSelf =
                    currentUser &&
                    entry.username.toLowerCase() === currentUser.username.toLowerCase();

                  // Map problem_id -> ContestProblemScore
                  const probScores = new Map(
                    entry.problems && Array.isArray(entry.problems)
                      ? entry.problems.map((ps) => [ps.problem_id, ps])
                      : Object.entries(entry.problem_scores || {}).map(([k, v]) => [Number(k), v])
                  );

                  return (
                    <tr
                      key={entry.user_id}
                      className={`transition-colors ${
                        isSelf
                          ? "bg-amber-500/10 hover:bg-amber-500/15 font-semibold"
                          : "hover:bg-[var(--accent)]/40"
                      }`}
                    >
                      <td className="py-3 px-4 text-center font-mono font-bold text-[var(--foreground)]">
                        #{entry.rank}
                      </td>
                      <td className="py-3 px-4 font-medium text-[var(--foreground)]">
                        <div className="flex items-center gap-1.5">
                          <span>{entry.username}</span>
                          {isSelf && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded font-normal">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400">
                        {entry.problems_solved}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[var(--muted-foreground)]">
                        {Math.floor(entry.penalty_seconds / 60)}m
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[var(--foreground)] font-semibold">
                        {entry.score}
                      </td>

                      {/* Problem breakdown columns */}
                      {contest.problems.map((p) => {
                        const scoreItem = probScores.get(p.problem_id);
                        if (!scoreItem || scoreItem.attempts === 0) {
                          return (
                            <td
                              key={p.id}
                              className="py-3 px-3 text-center font-mono text-[var(--muted-foreground)]/50"
                            >
                              —
                            </td>
                          );
                        }

                        if (scoreItem.is_solved) {
                          const solvedMinutes = scoreItem.solved_time_seconds
                            ? Math.floor(scoreItem.solved_time_seconds / 60)
                            : 0;
                          return (
                            <td
                              key={p.id}
                              className="py-3 px-3 text-center font-mono text-emerald-400 bg-emerald-500/5"
                            >
                              <div className="font-bold flex items-center justify-center gap-0.5">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>+{scoreItem.attempts}</span>
                              </div>
                              <div className="text-[10px] text-[var(--muted-foreground)]">
                                {solvedMinutes}m
                              </div>
                            </td>
                          );
                        }

                        // Attempted but unsolved
                        return (
                          <td
                            key={p.id}
                            className="py-3 px-3 text-center font-mono text-red-400 bg-red-500/5"
                          >
                            <div className="font-bold">-{scoreItem.attempts}</div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

