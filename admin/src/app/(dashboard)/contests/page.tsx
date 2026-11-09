import Link from "next/link";
import { Plus, Eye, Edit3, Trophy, Users, FileCode2 } from "lucide-react";
import { listContests } from "@/lib/api/contests";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TablePagination } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ContestFilters } from "./_components/contest-filters";
import { ContestStatusBadge } from "./_components/contest-status-badge";
import { ContestDeleteButton } from "./_components/contest-delete-button";
import { formatDate } from "@/lib/utils";
import type { ContestListResponse } from "@/types/contest";

interface ContestsPageProps {
  searchParams: Promise<{
    skip?: string;
    limit?: string;
    status?: string;
    search?: string;
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

export default async function ContestsPage({ searchParams }: ContestsPageProps) {
  const resolvedParams = await searchParams;
  const skip = parseInt(resolvedParams.skip || "0", 10);
  const limit = parseInt(resolvedParams.limit || "20", 10);

  const user = await getCurrentUser();
  const userRole = user?.role || "moderator";

  let data: ContestListResponse = {
    total: 0,
    skip: 0,
    limit: 20,
    server_time: new Date().toISOString(),
    contests: [],
  };
  let fetchError = false;

  try {
    data = await listContests({
      skip,
      limit,
      status: resolvedParams.status,
      search: resolvedParams.search,
    });
  } catch {
    fetchError = true;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contest Management"
        description="Schedule, configure, and manage timed ICPC-style coding competitions."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Contests" },
        ]}
        actions={
          <Link href="/contests/new">
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Contest
            </Button>
          </Link>
        }
      />

      <ContestFilters />

      {fetchError ? (
        <div className="p-4 rounded border border-red-900/60 bg-red-950/20 text-xs text-red-300">
          Failed to load contests from backend. Please ensure the backend is running.
        </div>
      ) : data.contests.length === 0 ? (
        <EmptyState
          title="No contests found"
          description="No contests matched your filter criteria, or none have been scheduled yet."
          action={
            <Link href="/contests/new">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create First Contest
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Contest</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-44">Start Time (UTC)</TableHead>
                <TableHead className="w-44">End Time (UTC)</TableHead>
                <TableHead className="w-24">Duration</TableHead>
                <TableHead className="w-24 text-center">Problems</TableHead>
                <TableHead className="w-28 text-center">Participants</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.contests.map((contest) => (
                <TableRow
                  key={contest.id}
                  className="border-zinc-800/60 hover:bg-zinc-800/30"
                >
                  <TableCell className="font-mono text-xs text-zinc-500">
                    #{contest.id}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <Link
                        href={`/contests/${contest.id}`}
                        className="font-medium text-xs text-zinc-200 hover:text-white hover:underline transition-colors flex items-center gap-1.5"
                      >
                        <Trophy className="h-3.5 w-3.5 text-zinc-400" />
                        {contest.title}
                      </Link>
                      {contest.description && (
                        <span className="text-[11px] text-zinc-500 line-clamp-1 max-w-sm mt-0.5">
                          {contest.description}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ContestStatusBadge status={contest.status} />
                  </TableCell>
                  <TableCell className="text-xs text-zinc-400">
                    {formatDate(contest.start_time)}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-400">
                    {formatDate(contest.end_time)}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-400">
                    {formatDuration(contest.duration_seconds)}
                  </TableCell>
                  <TableCell className="text-xs text-center text-zinc-300">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/80 font-mono text-[11px]">
                      <FileCode2 className="h-3 w-3 text-zinc-400" />
                      {contest.problem_count}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-center text-zinc-300">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/80 font-mono text-[11px]">
                      <Users className="h-3 w-3 text-zinc-400" />
                      {contest.participant_count}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/contests/${contest.id}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
                          title="View Details"
                          aria-label={`View contest ${contest.title}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>

                      {contest.status !== "ended" && (
                        <Link href={`/contests/${contest.id}/edit`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
                            title="Edit Contest"
                            aria-label={`Edit contest ${contest.title}`}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      )}

                      <ContestDeleteButton
                        contestId={contest.id}
                        contestTitle={contest.title}
                        status={contest.status}
                        userRole={userRole}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePagination
            total={data.total}
            skip={data.skip}
            limit={data.limit}
          />
        </div>
      )}
    </div>
  );
}

