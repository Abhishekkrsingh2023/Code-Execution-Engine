import Link from "next/link";
import { Eye, Shield, Check, X } from "lucide-react";
import { listAdminUsers } from "@/lib/api/users";
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
import { UserFilters } from "./_components/user-filters";
import { UserRoleSelect } from "./_components/user-role-select";
import { UserStatusSelect } from "./_components/user-status-select";
import { UserDeleteButton } from "./_components/user-delete-button";
import { formatDate, formatNumber } from "@/lib/utils";
import type { AdminUserResponse } from "@/types/user";

interface UsersPageProps {
  searchParams: Promise<{
    skip?: string;
    limit?: string;
    role?: string;
    status?: string;
    search?: string;
  }>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const resolvedParams = await searchParams;
  const skip = parseInt(resolvedParams.skip || "0", 10);
  const limit = parseInt(resolvedParams.limit || "20", 10);

  let data: { total: number; skip: number; limit: number; users: AdminUserResponse[] } = {
    total: 0,
    skip: 0,
    limit: 20,
    users: [],
  };
  let fetchError = false;

  try {
    data = await listAdminUsers({
      skip,
      limit,
      role: resolvedParams.role,
      status: resolvedParams.status,
      search: resolvedParams.search,
    });
  } catch {
    fetchError = true;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="User Management"
        description="Inspect registered accounts, manage roles and permissions, and oversee platform activity."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Users" },
        ]}
      />

      <UserFilters />

      {fetchError ? (
        <div className="p-4 rounded border border-red-900/60 bg-red-950/20 text-xs text-red-300">
          Failed to load users from backend. Ensure your admin session is valid.
        </div>
      ) : data.users.length === 0 ? (
        <EmptyState
          title="No users found"
          description="No user accounts match the current filter criteria."
        />
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Profile</TableHead>
                <TableHead className="w-32">Role</TableHead>
                <TableHead className="w-32">Account Status</TableHead>
                <TableHead className="w-28">Verification</TableHead>
                <TableHead className="w-32">Telemetry</TableHead>
                <TableHead className="w-36">Registered</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/users/${user.id}`}
                          className="font-medium text-zinc-100 hover:text-zinc-300 transition-colors"
                        >
                          {user.name ? `${user.name} (@${user.username})` : `@${user.username}`}
                        </Link>
                        {user.is_protected && (
                          <span
                            title="Protected system account"
                            className="inline-flex items-center text-amber-400"
                          >
                            <Shield className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        {user.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <UserRoleSelect
                      userId={user.id}
                      initialRole={user.role}
                      isProtected={user.is_protected}
                    />
                  </TableCell>
                  <TableCell>
                    <UserStatusSelect
                      userId={user.id}
                      initialStatus={user.status}
                      isProtected={user.is_protected}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-[11px]">
                      {user.is_email_verified ? (
                        <span className="flex items-center text-emerald-400 gap-1 font-mono">
                          <Check className="h-3 w-3" /> Verified
                        </span>
                      ) : (
                        <span className="flex items-center text-zinc-500 gap-1 font-mono">
                          <X className="h-3 w-3" /> Pending
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-[11px] font-mono text-zinc-400">
                    <div>{user.problems_solved} solved / {user.submissions_count} subs</div>
                    <div className="text-zinc-500">{user.total_score} pts</div>
                  </TableCell>
                  <TableCell className="text-[11px] font-mono text-zinc-500">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/users/${user.id}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
                          title="View user details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <UserDeleteButton
                        userId={user.id}
                        username={user.username}
                        isProtected={user.is_protected}
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
            itemName="users"
          />
        </div>
      )}
    </div>
  );
}

