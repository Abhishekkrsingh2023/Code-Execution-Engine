import {
  getUserStats,
  getProblemStats,
  getSubmissionStats,
  getActivityStats,
} from "@/lib/api/stats";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatNumber, formatDate } from "@/lib/utils";
import {
  BarChart3,
  Users,
  Code2,
  FileCheck2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Flame,
} from "lucide-react";

interface AnalyticsPageProps {
  searchParams: Promise<{
    days?: string;
  }>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const resolved = await searchParams;
  const days = parseInt(resolved.days || "30", 10);

  let userStats;
  let problemStats;
  let submissionStats;
  let activityStats;

  try {
    [userStats, problemStats, submissionStats, activityStats] = await Promise.all([
      getUserStats(days),
      getProblemStats(),
      getSubmissionStats(days),
      getActivityStats(),
    ]);
  } catch {
    // If backend offline
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Analytics & Metrics"
        description={`In-depth system telemetry, submission execution analysis, user demographics, and catalog growth across the past ${days} days.`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Analytics" },
        ]}
      />

      {submissionStats && userStats && problemStats ? (
        <>
          {/* Top High-Level Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="p-4 pb-1">
                <CardTitle className="text-xs text-zinc-400">Total Submissions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-2xl font-bold font-mono text-zinc-100">
                  {formatNumber(submissionStats.total_submissions)}
                </div>
                <div className="text-xs text-emerald-400 mt-1 font-mono">
                  {submissionStats.success_rate.toFixed(1)}% success rate
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-1">
                <CardTitle className="text-xs text-zinc-400">Registered Users</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-2xl font-bold font-mono text-zinc-100">
                  {formatNumber(userStats.total_users)}
                </div>
                <div className="text-xs text-zinc-400 mt-1">
                  +{formatNumber(userStats.new_registrations_in_period)} in period
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-1">
                <CardTitle className="text-xs text-zinc-400">Active Problems</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-2xl font-bold font-mono text-zinc-100">
                  {formatNumber(problemStats.total_problems)}
                </div>
                <div className="text-xs text-zinc-400 mt-1">
                  {problemStats.total_including_deleted} with archived
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-1">
                <CardTitle className="text-xs text-zinc-400">Accepted Solutions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-2xl font-bold font-mono text-emerald-400">
                  {formatNumber(submissionStats.accepted)}
                </div>
                <div className="text-xs text-zinc-400 mt-1">
                  {formatNumber(submissionStats.rejected)} rejected
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Submission Verdict Analysis */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <FileCheck2 className="h-4 w-4" />
              Submission Verdict Breakdown
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
              <div className="p-3 rounded border border-emerald-950/60 bg-emerald-950/20">
                <span className="text-emerald-400 block text-[11px]">Accepted</span>
                <span className="text-lg font-bold text-emerald-200 mt-1 block">
                  {formatNumber(submissionStats.accepted)}
                </span>
              </div>

              <div className="p-3 rounded border border-rose-950/60 bg-rose-950/20">
                <span className="text-rose-400 block text-[11px]">Wrong Answer</span>
                <span className="text-lg font-bold text-rose-200 mt-1 block">
                  {formatNumber(submissionStats.rejected)}
                </span>
              </div>

              <div className="p-3 rounded border border-amber-950/60 bg-amber-950/20">
                <span className="text-amber-400 block text-[11px]">Time Limit Exceeded</span>
                <span className="text-lg font-bold text-amber-200 mt-1 block">
                  {formatNumber(submissionStats.time_limit_exceeded)}
                </span>
              </div>

              <div className="p-3 rounded border border-purple-950/60 bg-purple-950/20">
                <span className="text-purple-400 block text-[11px]">Memory Limit Exceeded</span>
                <span className="text-lg font-bold text-purple-200 mt-1 block">
                  {formatNumber(submissionStats.memory_limit_exceeded)}
                </span>
              </div>

              <div className="p-3 rounded border border-zinc-800 bg-zinc-900/60">
                <span className="text-zinc-400 block text-[11px]">Compilation Error</span>
                <span className="text-lg font-bold text-zinc-200 mt-1 block">
                  {formatNumber(submissionStats.compilation_errors)}
                </span>
              </div>

              <div className="p-3 rounded border border-zinc-800 bg-zinc-900/60">
                <span className="text-zinc-400 block text-[11px]">Runtime Error</span>
                <span className="text-lg font-bold text-zinc-200 mt-1 block">
                  {formatNumber(submissionStats.runtime_errors)}
                </span>
              </div>
            </div>

            {/* Daily Submission Volume Table */}
            {submissionStats.submissions_trend && submissionStats.submissions_trend.length > 0 && (
              <div className="pt-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                  Daily Submissions Activity
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {submissionStats.submissions_trend.slice(-14).map((point) => (
                    <div
                      key={point.date}
                      className="p-2 rounded border border-zinc-800/80 bg-zinc-950/60 text-center"
                    >
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {point.date.slice(5)}
                      </div>
                      <div className="text-sm font-bold font-mono text-zinc-200 mt-0.5">
                        {point.count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Distribution & Demographics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                User Roles & Account Status
              </h2>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[11px] text-zinc-500 font-mono uppercase block mb-1.5">
                    By Role
                  </span>
                  <div className="space-y-1.5">
                    {Object.entries(userStats.by_role || {}).map(([role, count]) => (
                      <div
                        key={role}
                        className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-800/60 font-mono"
                      >
                        <span className="capitalize text-zinc-300">{role}</span>
                        <span className="font-bold text-zinc-100">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-[11px] text-zinc-500 font-mono uppercase block mb-1.5">
                    By Account Status
                  </span>
                  <div className="space-y-1.5">
                    {Object.entries(userStats.by_status || {}).map(([status, count]) => (
                      <div
                        key={status}
                        className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-800/60 font-mono"
                      >
                        <span className="capitalize text-zinc-300">{status}</span>
                        <span className="font-bold text-zinc-100">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Problem Catalog Breakdown */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Code2 className="h-4 w-4" />
                Problem Catalog Distribution
              </h2>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[11px] text-zinc-500 font-mono uppercase block mb-1.5">
                    By Difficulty
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(problemStats.by_difficulty || {}).map(([diff, count]) => (
                      <div
                        key={diff}
                        className="p-2 rounded bg-zinc-950 border border-zinc-800/60 text-center font-mono"
                      >
                        <div className="text-[10px] capitalize text-zinc-400">{diff}</div>
                        <div className="text-base font-bold text-zinc-100 mt-0.5">{count}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-[11px] text-zinc-500 font-mono uppercase block mb-1.5">
                    Top Moderator Authors
                  </span>
                  {problemStats.problems_by_moderator && problemStats.problems_by_moderator.length > 0 ? (
                    <div className="space-y-1.5">
                      {problemStats.problems_by_moderator.slice(0, 4).map((mod) => (
                        <div
                          key={mod.moderator_id}
                          className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-800/60 font-mono text-xs"
                        >
                          <span className="text-zinc-300">@{mod.username}</span>
                          <span className="font-bold text-zinc-100">{mod.count} problems</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-xs text-zinc-500 italic">
                      No moderator authored problems recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="p-6 rounded border border-red-900/60 bg-red-950/20 text-xs text-red-300">
          Failed to load analytics statistics. Ensure backend is running and you are signed in with administrator permissions.
        </div>
      )}
    </div>
  );
}

