import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Trophy,
  Calendar,
  Clock,
  Users,
  FileCode2,
  Lock,
  ArrowRight,
  Award,
  AlertTriangle,
} from "lucide-react";
import { getContest, getContestLeaderboard } from "@/lib/api/contests";
import { getCurrentUser } from "@/lib/auth/session";
import { ContestStatusBadge } from "../_components/contest-status-badge";
import { ContestRegisterButton } from "./_components/contest-register-button";
import { LobbyCountdown } from "./_components/lobby-countdown";
import { DifficultyBadge } from "@/components/shared/difficulty-badge";
import { formatDate, formatDuration } from "@/lib/utils";
import type { ContestResponse } from "@/types/contest";

export const dynamic = "force-dynamic";

interface ContestLobbyPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ContestLobbyPage({ params }: ContestLobbyPageProps) {
  const resolvedParams = await params;
  const contestId = parseInt(resolvedParams.id, 10);
  if (isNaN(contestId)) {
    notFound();
  }

  const user = await getCurrentUser();
  const isLoggedIn = Boolean(user);

  let contest: ContestResponse;
  try {
    contest = await getContest(contestId);
  } catch {
    notFound();
  }

  // Fetch leaderboard if live or ended
  let leaderboard = null;
  if (contest.status !== "upcoming") {
    try {
      leaderboard = await getContestLeaderboard(contestId, { limit: 15 });
    } catch {
      // Non-critical
    }
  }

  const leaderboardEntries = leaderboard?.entries ?? leaderboard?.leaderboard ?? [];

  const isLive = contest.status === "live";
  const isUpcoming = contest.status === "upcoming";
  const isEnded = contest.status === "ended";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Contest Banner & Registration Header */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xs text-[var(--muted-foreground)]">
                Contest #{contest.id}
              </span>
              <ContestStatusBadge status={contest.status} />
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-[var(--foreground)] tracking-tight">
              {contest.title}
            </h1>

            {contest.description && (
              <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-line leading-relaxed">
                {contest.description}
              </p>
            )}
          </div>

          {/* Lobby Countdown Box */}
          <div className="shrink-0 w-full lg:w-72">
            <LobbyCountdown
              status={contest.status}
              startTime={contest.start_time}
              endTime={contest.end_time}
              serverTime={contest.server_time}
            />
          </div>
        </div>

        {/* Registration CTA Bar */}
        <div className="mt-6 pt-6 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
          <ContestRegisterButton
            contestId={contest.id}
            status={contest.status}
            isRegistered={contest.is_registered}
            isLoggedIn={isLoggedIn}
          />

          <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <strong>{contest.participant_count}</strong> registered
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <FileCode2 className="h-3.5 w-3.5" />
              <strong>{contest.problem_count}</strong> problems
            </span>
            <span>•</span>
            <span>Penalty: <strong>{contest.penalty_minutes}m</strong></span>
          </div>
        </div>
      </div>

      {/* Rules & Meta Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-1">
          <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider block">
            Start Time
          </span>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
            <Calendar className="h-3.5 w-3.5 text-amber-500" />
            {formatDate(contest.start_time)}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-1">
          <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider block">
            End Time
          </span>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
            <Clock className="h-3.5 w-3.5 text-emerald-500" />
            {formatDate(contest.end_time)}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-1">
          <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider block">
            Duration
          </span>
          <div className="text-xs font-semibold text-[var(--foreground)]">
            {formatDuration(contest.duration_seconds)}
          </div>
          <span className="text-[10px] text-[var(--muted-foreground)] block">
            ICPC Scoring Model
          </span>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-1">
          <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider block">
            Scoring Rules
          </span>
          <div className="text-xs font-semibold text-[var(--foreground)]">
            +{contest.penalty_minutes} min per wrong attempt
          </div>
          <span className="text-[10px] text-[var(--muted-foreground)] block">
            Only applies to solved problems
          </span>
        </div>
      </div>

      {/* Problem List Section */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-lg font-bold text-[var(--foreground)]">
              Contest Problems
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              {isUpcoming
                ? "Problems are locked and will be revealed when the contest starts."
                : "Problems in this contest are listed in order (P1, P2...)."
              }
            </p>
          </div>
          {isLive && contest.is_registered && (
            <Link href={`/contests/${contest.id}/arena`}>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:underline">
                Open in Arena
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          )}
        </div>

        {isUpcoming ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center space-y-2">
            <Lock className="h-6 w-6 text-[var(--muted-foreground)] mx-auto opacity-60" />
            <p className="text-xs font-medium text-[var(--muted-foreground)]">
              Problems are hidden until the contest begins.
            </p>
            <p className="text-[11px] text-[var(--muted-foreground)] opacity-75">
              Make sure to register beforehand to enter the arena as soon as it goes live.
            </p>
          </div>
        ) : contest.problems.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--muted-foreground)]">
            No problems have been assigned to this contest.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg overflow-hidden">
            {contest.problems.map((prob) => {
              const problemLink = isLive && contest.is_registered
                ? `/contests/${contest.id}/arena?p=${prob.position}`
                : isEnded
                ? `/problems/${prob.problem_id}`
                : `/contests/${contest.id}`;

              return (
                <div
                  key={prob.id}
                  className="flex items-center justify-between p-3.5 hover:bg-[var(--accent)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-8 items-center justify-center rounded bg-[var(--accent)] font-mono text-xs font-bold text-[var(--foreground)]">
                      P{prob.position}
                    </span>
                    <Link
                      href={problemLink}
                      className="font-medium text-xs sm:text-sm text-[var(--foreground)] hover:text-[var(--brand)] hover:underline"
                    >
                      {prob.title}
                    </Link>
                    <DifficultyBadge difficulty={prob.difficulty} />
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-[var(--muted-foreground)]">
                      {prob.points} pts
                    </span>
                    {(isLive && contest.is_registered) || isEnded ? (
                      <Link
                        href={problemLink}
                        className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leaderboard Preview (Live or Ended) */}
      {!isUpcoming && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-bold text-[var(--foreground)]">
                {isLive ? "Live Leaderboard" : "Final Standings"}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--muted-foreground)] font-mono">
                {leaderboard ? `${leaderboard.total_participants} Competitors` : ""}
              </span>
              <Link href={`/contests/${contest.id}/leaderboard`}>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)] hover:underline">
                  Full Standings
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>
          </div>

          {leaderboardEntries.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-lg">
              No submissions recorded yet for this contest.
            </div>
          ) : (
            <div className="border border-[var(--border)] rounded-lg overflow-hidden text-xs">
              <div className="grid grid-cols-12 bg-[var(--accent)]/50 p-2.5 font-semibold text-[var(--muted-foreground)] border-b border-[var(--border)]">
                <div className="col-span-2 sm:col-span-1">Rank</div>
                <div className="col-span-6 sm:col-span-5">Competitor</div>
                <div className="col-span-2 text-center">Solved</div>
                <div className="col-span-2 sm:col-span-2 text-right">Penalty</div>
                <div className="col-span-2 text-right hidden sm:block">Score</div>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {leaderboardEntries.map((entry) => (
                  <div
                    key={entry.user_id}
                    className="grid grid-cols-12 p-2.5 items-center hover:bg-[var(--accent)] transition-colors"
                  >
                    <div className="col-span-2 sm:col-span-1 font-mono font-bold text-[var(--foreground)]">
                      #{entry.rank}
                    </div>
                    <div className="col-span-6 sm:col-span-5 font-medium text-[var(--foreground)] truncate">
                      {entry.username}
                    </div>
                    <div className="col-span-2 text-center font-bold text-emerald-400 font-mono">
                      {entry.problems_solved}
                    </div>
                    <div className="col-span-2 sm:col-span-2 text-right font-mono text-[var(--muted-foreground)]">
                      {Math.floor(entry.penalty_seconds / 60)}m
                    </div>
                    <div className="col-span-2 text-right font-mono font-semibold text-[var(--foreground)] hidden sm:block">
                      {entry.score}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
