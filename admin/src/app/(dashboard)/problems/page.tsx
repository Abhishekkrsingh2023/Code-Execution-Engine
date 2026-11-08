import Link from "next/link";
import { Plus, Eye, Edit3 } from "lucide-react";
import { listProblems } from "@/lib/api/problems";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { ProblemFilters } from "./_components/problem-filters";
import { ProblemStatusSelect } from "./_components/problem-status-select";
import { ProblemDeleteButton } from "./_components/problem-delete-button";
import { formatDate } from "@/lib/utils";

import type { ProblemResponse } from "@/types/problem";

interface ProblemsPageProps {
  searchParams: Promise<{
    skip?: string;
    limit?: string;
    difficulty?: string;
    status?: string;
    search?: string;
  }>;
}

export default async function ProblemsPage({ searchParams }: ProblemsPageProps) {
  const resolvedParams = await searchParams;
  const skip = parseInt(resolvedParams.skip || "0", 10);
  const limit = parseInt(resolvedParams.limit || "20", 10);

  let data: { total: number; skip: number; limit: number; problems: ProblemResponse[] } = {
    total: 0,
    skip: 0,
    limit: 20,
    problems: [],
  };
  let fetchError = false;

  try {
    data = await listProblems({
      skip,
      limit,
      difficulty: resolvedParams.difficulty,
      status: resolvedParams.status,
      search: resolvedParams.search,
    });
  } catch {
    fetchError = true;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Problem Catalog"
        description="Author and moderate coding challenges, execution constraints, and test suites."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Problems" },
        ]}
        actions={
          <Link href="/problems/new">
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Problem
            </Button>
          </Link>
        }
      />

      <ProblemFilters />

      {fetchError ? (
        <div className="p-4 rounded border border-red-900/60 bg-red-950/20 text-xs text-red-300">
          Failed to load problems from backend. Ensure backend service is reachable.
        </div>
      ) : data.problems.length === 0 ? (
        <EmptyState
          title="No problems found"
          description="No coding challenges matched the filter criteria or none have been authored yet."
          action={
            <Link href="/problems/new">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create First Problem
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Problem</TableHead>
                <TableHead className="w-24">Difficulty</TableHead>
                <TableHead className="w-28">Category</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-28">Constraints</TableHead>
                <TableHead className="w-32">Updated</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.problems.map((problem) => (
                <TableRow key={problem.id}>
                  <TableCell className="font-mono text-xs text-zinc-500">
                    #{problem.id}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <Link
                        href={`/problems/${problem.id}`}
                        className="font-medium text-zinc-100 hover:text-zinc-300 transition-colors"
                      >
                        {problem.title}
                      </Link>
                      <span className="text-[11px] text-zinc-500 font-mono mt-0.5">
                        Topic: {problem.topic || "General"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge type="difficulty" value={problem.difficulty} />
                  </TableCell>
                  <TableCell className="text-zinc-400 text-xs font-mono">
                    {problem.category}
                  </TableCell>
                  <TableCell>
                    <ProblemStatusSelect
                      problemId={problem.id}
                      initialStatus={problem.status}
                    />
                  </TableCell>
                  <TableCell className="text-[11px] font-mono text-zinc-400">
                    <div>{problem.time_limit}s limit</div>
                    <div className="text-zinc-500">{problem.memory_limit}MB</div>
                  </TableCell>
                  <TableCell className="text-[11px] font-mono text-zinc-500">
                    {formatDate(problem.updated_at || problem.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/problems/${problem.id}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
                          title="View / Edit Problem"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <ProblemDeleteButton
                        problemId={problem.id}
                        problemTitle={problem.title}
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
            itemName="problems"
          />
        </div>
      )}
    </div>
  );
}

