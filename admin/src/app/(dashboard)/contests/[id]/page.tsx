import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Edit3,
  Calendar,
  Clock,
  Users,
  FileCode2,
  AlertTriangle,
  ExternalLink,
  Award,
} from "lucide-react";
import { getContest, getContestLeaderboard } from "@/lib/api/contests";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ContestStatusBadge } from "../_components/contest-status-badge";
import { ContestDeleteButton } from "../_components/contest-delete-button";
import { formatDate } from "@/lib/utils";

interface ContestDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export default async function ContestDetailPage({
  params,
}: ContestDetailPageProps) {
  const resolvedParams = await params;
  const contestId = parseInt(resolvedParams.id, 10);
  if (isNaN(contestId)) {
    notFound();
  }

  const user = await getCurrentUser();
  const userRole = user?.role || "moderator";

  let contest;
  try {
    contest = await getContest(contestId);
  } catch {
    notFound();
  }

  // Fetch leaderboard if live or ended
  let leaderboard = null;
  if (contest.status !== "upcoming") {
    try {
      leaderboard = await getContestLeaderboard(contestId, { limit: 20 });
    } catch {
      // Non-critical if leaderboard fails or has no entries
    }
  }

  const leaderboardEntries = leaderboard?.entries ?? leaderboard?.leaderboard ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={contest.title}
        description={contest.description || "No description provided."}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Contests", href: "/contests" },
          { label: `#${contest.id} ${contest.title}` },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {contest.status !== "ended" && (
              <Link href={`/contests/${contest.id}/edit`}>
                <Button size="sm">
                  <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                  Edit Contest
                </Button>
              </Link>
            )}
            <ContestDeleteButton
              contestId={contest.id}
              contestTitle={contest.title}
              status={contest.status}
              userRole={userRole}
              redirectAfterDelete
            />
          </div>
        }
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 font-normal uppercase tracking-wider">
              Status & Duration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center gap-2">
              <ContestStatusBadge status={contest.status} />
              <span className="text-xs text-zinc-400">
                {formatDuration(contest.duration_seconds)}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Penalty: {contest.penalty_minutes} min / wrong attempt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 font-normal uppercase tracking-wider">
              Start Time (UTC)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-200">
              <Calendar className="h-3.5 w-3.5 text-zinc-400" />
              {formatDate(contest.start_time)}
            </div>
            <p className="text-[11px] text-zinc-500">
              Server time: {formatDate(contest.server_time)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 font-normal uppercase tracking-wider">
              End Time (UTC)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-200">
              <Clock className="h-3.5 w-3.5 text-zinc-400" />
              {formatDate(contest.end_time)}
            </div>
            <p className="text-[11px] text-zinc-500">
              Registration closes at end time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 font-normal uppercase tracking-wider">
              Participation & Problems
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center gap-3 text-xs text-zinc-200">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-zinc-400" />
                <strong>{contest.participant_count}</strong> registered
              </span>
              <span className="flex items-center gap-1">
                <FileCode2 className="h-3.5 w-3.5 text-zinc-400" />
                <strong>{contest.problems.length}</strong> problems
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ordered Problems Section */}
      <Card>
        <CardHeader>
          <CardTitle>Ordered Contest Problems</CardTitle>
          <p className="text-xs text-zinc-500">
            Problems assigned to this contest in order of appearance (P1, P2, ...).
          </p>
        </CardHeader>
        <CardContent>
          {contest.problems.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded">
              No problems assigned to this contest.
            </div>
          ) : (
            <div className="rounded border border-zinc-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800">
                    <TableHead className="w-16">Position</TableHead>
                    <TableHead className="w-20">Problem ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-28">Difficulty</TableHead>
                    <TableHead className="w-24 text-right">Points</TableHead>
                    <TableHead className="w-24 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contest.problems.map((prob) => (
                    <TableRow key={prob.id} className="border-zinc-800/60">
                      <TableCell>
                        <span className="flex h-6 w-8 items-center justify-center rounded bg-zinc-800 font-mono text-[11px] font-bold text-zinc-200">
                          P{prob.position}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-500">
                        #{prob.problem_id}
                      </TableCell>
                      <TableCell className="font-medium text-xs text-zinc-200">
                        {prob.title}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="capitalize text-[10px] border-zinc-700 text-zinc-400"
                        >
                          {prob.difficulty}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-zinc-300">
                        {prob.points}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/problems/${prob.problem_id}`}
                          className="inline-flex items-center text-xs text-zinc-400 hover:text-zinc-100"
                          title="Open problem in catalog"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leaderboard Section (if contest live or ended) */}
      {contest.status !== "upcoming" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-amber-400" />
                  Contest Leaderboard
                </CardTitle>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Live ranking computed under ICPC scoring rules.
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {leaderboard ? `${leaderboard.total_participants} participants` : "No data"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {leaderboardEntries.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded">
                No submissions or ranked participants yet.
              </div>
            ) : (
              <div className="rounded border border-zinc-800 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800">
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="w-24 text-center">Solved</TableHead>
                      <TableHead className="w-28 text-right">Penalty Time</TableHead>
                      <TableHead className="w-24 text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboardEntries.map((entry) => (
                      <TableRow key={entry.user_id} className="border-zinc-800/60">
                        <TableCell className="font-mono text-xs font-bold text-zinc-300">
                          #{entry.rank}
                        </TableCell>
                        <TableCell className="font-medium text-xs text-zinc-200">
                          {entry.username}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-emerald-400 font-bold">
                          {entry.problems_solved}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-zinc-400">
                          {Math.floor(entry.penalty_seconds / 60)}m
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-zinc-300">
                          {entry.score}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

