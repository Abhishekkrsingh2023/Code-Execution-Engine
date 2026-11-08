import { notFound } from "next/navigation";
import { getAdminUserDetail } from "@/lib/api/users";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserEditDialog } from "../_components/user-edit-dialog";
import { UserDeleteButton } from "../_components/user-delete-button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatDate, formatNumber } from "@/lib/utils";
import { Shield, Check, X } from "lucide-react";
import type { AdminUserDetailResponse } from "@/types/user";

interface UserDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const { id } = await params;

  let user: AdminUserDetailResponse | null = null;
  try {
    user = await getAdminUserDetail(id);
  } catch {
    notFound();
  }

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title={user.name ? `${user.name} (@${user.username})` : `@${user.username}`}
        description={`User UUID: ${user.id}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Users", href: "/users" },
          { label: `@${user.username}` },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge type="role" value={user.role} />
            <StatusBadge type="user_status" value={user.status} />
            <div className="h-4 w-px bg-zinc-800 mx-1" />
            <UserEditDialog user={user} />
            <UserDeleteButton
              userId={user.id}
              username={user.username}
              isProtected={user.is_protected}
              redirectAfterDelete
            />
          </div>
        }
      />

      {/* Account Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
              Problems Solved
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold font-mono text-zinc-100">
              {user.problems_solved}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
              Submissions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold font-mono text-zinc-100">
              {user.submissions_count}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
              Total Score
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold font-mono text-zinc-100">
              {user.total_score} pts
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
              Problems Created
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold font-mono text-zinc-100">
              {user.problems_created_count}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profile Overview Details */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">
          Account Profile Attributes
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <span className="text-zinc-500 block mb-0.5">Email Address</span>
            <span className="text-zinc-200">{user.email}</span>
          </div>
          <div>
            <span className="text-zinc-500 block mb-0.5">Registered On</span>
            <span className="text-zinc-200">{formatDate(user.created_at)}</span>
          </div>
          <div>
            <span className="text-zinc-500 block mb-0.5">Security Credentials</span>
            <span className="text-zinc-200">
              {user.has_password ? "Password set" : "Passwordless OTP only"}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 block mb-0.5">System Protection</span>
            <span className="text-zinc-200 flex items-center gap-1">
              {user.is_protected ? (
                <>
                  <Shield className="h-3.5 w-3.5 text-amber-400" />
                  Protected Account
                </>
              ) : (
                "Standard Account"
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Recent User Submissions ({user.recent_submissions?.length || 0})
          </h2>
        </div>
        {user.recent_submissions && user.recent_submissions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Problem ID</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="text-right">Submitted At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.recent_submissions.map((sub, idx) => (
                <TableRow key={sub.id || idx}>
                  <TableCell className="font-mono text-xs">
                    #{sub.problem_id}
                  </TableCell>
                  <TableCell className="font-mono text-xs uppercase">
                    {sub.language}
                  </TableCell>
                  <TableCell>
                    <StatusBadge type="audit_status" value={sub.status} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {sub.score ?? 0}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] text-zinc-500">
                    {formatDate(sub.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-6 text-center text-xs text-zinc-500">
            No submissions recorded for this user yet.
          </div>
        )}
      </div>

      {/* Recent Audit Actions */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Recent Audit Trail ({user.recent_audit_actions?.length || 0})
          </h2>
        </div>
        {user.recent_audit_actions && user.recent_audit_actions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Client IP</TableHead>
                <TableHead className="text-right">Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.recent_audit_actions.map((act, idx) => (
                <TableRow key={act.id || idx}>
                  <TableCell className="font-mono text-xs text-zinc-200">
                    {act.action}
                  </TableCell>
                  <TableCell>
                    <StatusBadge type="audit_status" value={act.status} />
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-zinc-500">
                    {act.ip_address || "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] text-zinc-500">
                    {formatDate(act.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-6 text-center text-xs text-zinc-500">
            No audit records logged for this user.
          </div>
        )}
      </div>
    </div>
  );
}

