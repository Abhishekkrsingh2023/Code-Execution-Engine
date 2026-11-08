import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/api/stats";
import { listProblems } from "@/lib/api/problems";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatNumber } from "@/lib/utils";
import Link from "next/link";
import {
  Users,
  Code2,
  FileCheck2,
  Activity,
  Plus,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import type { DashboardStatsResponse } from "@/types/stats";

export default async function OverviewPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  let stats: DashboardStatsResponse | null = null;
  let moderatorProblemsCount = 0;

  if (isAdmin) {
    try {
      stats = await getDashboardStats(30);
    } catch {
      // Backend may be offline during build
    }
  } else {
    try {
      const res = await listProblems({ limit: 1 });
      moderatorProblemsCount = res.total;
    } catch {
      // Backend may be offline
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Overview"
        description={
          isAdmin
            ? "Consolidated 30-day telemetry, execution statistics, and system health."
            : "Content moderation workspace and problem catalog metrics."
        }
        actions={
          <Link href="/problems/new">
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Problem
            </Button>
          </Link>
        }
      />

      {isAdmin && stats ? (
        <>
          {/* Admin Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-zinc-400">
                  Total Registered Users
                </CardTitle>
                <Users className="h-4 w-4 text-zinc-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">
                  {formatNumber(stats.users.total_users)}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  +{formatNumber(stats.users.new_registrations_in_period)} new in past 30 days
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-zinc-400">
                  Total Active Problems
                </CardTitle>
                <Code2 className="h-4 w-4 text-zinc-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">
                  {formatNumber(stats.problems.total_problems)}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {formatNumber(stats.problems.total_including_deleted)} including archived/deleted
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-zinc-400">
                  Code Submissions
                </CardTitle>
                <FileCheck2 className="h-4 w-4 text-zinc-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">
                  {formatNumber(stats.submissions.total_submissions)}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {stats.submissions.success_rate.toFixed(1)}% overall pass rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-zinc-400">
                  System Health
                </CardTitle>
                <Activity className="h-4 w-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-emerald-400">
                  Operational
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  All workers and runners healthy
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Submissions Verdict Breakdown */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
              30-Day Submission Verdicts Breakdown
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-3 rounded border border-emerald-950/60 bg-emerald-950/20">
                <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Accepted
                </div>
                <div className="text-lg font-bold font-mono mt-1 text-emerald-300">
                  {formatNumber(stats.submissions.accepted)}
                </div>
              </div>

              <div className="p-3 rounded border border-rose-950/60 bg-rose-950/20">
                <div className="flex items-center gap-1.5 text-rose-400 font-medium">
                  <XCircle className="h-3.5 w-3.5" />
                  Wrong / Rejected
                </div>
                <div className="text-lg font-bold font-mono mt-1 text-rose-300">
                  {formatNumber(stats.submissions.rejected)}
                </div>
              </div>

              <div className="p-3 rounded border border-amber-950/60 bg-amber-950/20">
                <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                  <Clock className="h-3.5 w-3.5" />
                  Time Limit (TLE)
                </div>
                <div className="text-lg font-bold font-mono mt-1 text-amber-300">
                  {formatNumber(stats.submissions.time_limit_exceeded)}
                </div>
              </div>

              <div className="p-3 rounded border border-zinc-800 bg-zinc-900/60">
                <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Compile Errors
                </div>
                <div className="text-lg font-bold font-mono mt-1 text-zinc-300">
                  {formatNumber(stats.submissions.compilation_errors)}
                </div>
              </div>

              <div className="p-3 rounded border border-zinc-800 bg-zinc-900/60">
                <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
                  <Activity className="h-3.5 w-3.5" />
                  Runtime Errors
                </div>
                <div className="text-lg font-bold font-mono mt-1 text-zinc-300">
                  {formatNumber(stats.submissions.runtime_errors)}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Audit Events */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Recent Security & Administrative Actions
              </h2>
              <Link
                href="/audit-logs"
                className="text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1 transition-colors"
              >
                View all audit logs <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {stats.activity.recent_admin_actions.length > 0 ? (
              <div className="divide-y divide-zinc-800/80 text-xs">
                {stats.activity.recent_admin_actions.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="py-2.5 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-4 w-4 text-zinc-500 shrink-0" />
                      <div>
                        <span className="font-mono text-zinc-300">{log.action}</span>
                        <span className="text-zinc-500 ml-2">by</span>{" "}
                        <span className="text-zinc-400 font-medium">
                          {log.actor_username || "system"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge type="audit_status" value={log.status} />
                      <span className="text-[11px] font-mono text-zinc-500">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 py-3">No recent administrative actions recorded.</p>
            )}
          </div>
        </>
      ) : (
        /* Moderator View */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-zinc-400">Problem Catalog</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">
                  {formatNumber(moderatorProblemsCount)}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">Available problems in catalog</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-zinc-400">Authoring Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-400">Ready</div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Full problem & template creation enabled
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-zinc-400">Role Permissions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-semibold text-zinc-200">Content Moderator</div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Manage problems, starter templates & test suites
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col items-center justify-center text-center">
            <Code2 className="h-10 w-10 text-zinc-600 mb-3" />
            <h3 className="text-sm font-semibold text-zinc-200">
              Manage Challenges & Problems
            </h3>
            <p className="text-xs text-zinc-400 max-w-md mt-1 mb-4">
              Create and edit programming challenges with test case suites, time and memory execution limits, and multi-language templates.
            </p>
            <div className="flex gap-2">
              <Link href="/problems">
                <Button variant="outline" size="sm">
                  View Problems Catalog
                </Button>
              </Link>
              <Link href="/problems/new">
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Create New Problem
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

