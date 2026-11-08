import Link from "next/link";
import { Eye, Shield } from "lucide-react";
import { listAuditLogs } from "@/lib/api/audit";
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
import { AuditFilters } from "./_components/audit-filters";
import { formatDate } from "@/lib/utils";
import type { AuditLogResponse } from "@/types/audit";

interface AuditLogsPageProps {
  searchParams: Promise<{
    skip?: string;
    limit?: string;
    action?: string;
    actor_role?: string;
    target_type?: string;
    status?: string;
  }>;
}

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const resolvedParams = await searchParams;
  const skip = parseInt(resolvedParams.skip || "0", 10);
  const limit = parseInt(resolvedParams.limit || "20", 10);

  let data: { total: number; skip: number; limit: number; logs: AuditLogResponse[] } = {
    total: 0,
    skip: 0,
    limit: 20,
    logs: [],
  };
  let fetchError = false;

  try {
    data = await listAuditLogs({
      skip,
      limit,
      action: resolvedParams.action,
      actor_role: resolvedParams.actor_role,
      target_type: resolvedParams.target_type,
      status: resolvedParams.status,
    });
  } catch {
    fetchError = true;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Security & System Audit Logs"
        description="Immutable event trail recording all administrative actions, role updates, problem lifecycle modifications, and security operations."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Audit Logs" },
        ]}
      />

      <AuditFilters />

      {fetchError ? (
        <div className="p-4 rounded border border-red-900/60 bg-red-950/20 text-xs text-red-300">
          Failed to load audit records from backend. Ensure your admin session is valid.
        </div>
      ) : data.logs.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No audit records found"
          description="No security or administrative events matched the specified filter criteria."
        />
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Action</TableHead>
                <TableHead className="w-36">Actor</TableHead>
                <TableHead className="w-32">Target</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-32">Client IP</TableHead>
                <TableHead className="w-40">Timestamp</TableHead>
                <TableHead className="w-16 text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs font-semibold text-zinc-200">
                    {log.action}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-xs text-zinc-200">
                        {log.actor_username || "system"}
                      </span>
                      {log.actor_role && (
                        <span className="text-[10px] text-zinc-500 uppercase font-mono">
                          {log.actor_role}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-zinc-400">
                    {log.target_type ? (
                      <div>
                        <span className="text-zinc-300 capitalize">{log.target_type}</span>
                        {log.target_id && (
                          <span className="text-[10px] text-zinc-500 block truncate max-w-[120px]">
                            {log.target_id}
                          </span>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge type="audit_status" value={log.status} />
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-zinc-500">
                    {log.ip_address || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-zinc-500">
                    {formatDate(log.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/audit-logs/${log.id}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
                        title="Inspect Event"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePagination
            total={data.total}
            skip={data.skip}
            limit={data.limit}
            itemName="audit records"
          />
        </div>
      )}
    </div>
  );
}

