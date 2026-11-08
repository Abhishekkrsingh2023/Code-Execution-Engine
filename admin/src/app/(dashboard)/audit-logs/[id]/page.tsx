import { notFound } from "next/navigation";
import { getAuditLog } from "@/lib/api/audit";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { AuditLogResponse } from "@/types/audit";

interface AuditLogDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AuditLogDetailPage({ params }: AuditLogDetailPageProps) {
  const { id } = await params;

  let log: AuditLogResponse | null = null;
  try {
    log = await getAuditLog(id);
  } catch {
    notFound();
  }

  if (!log) {
    notFound();
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title={log.action}
        description={`Audit record UUID: ${log.id}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Audit Logs", href: "/audit-logs" },
          { label: log.action },
        ]}
        actions={<StatusBadge type="audit_status" value={log.status} />}
      />

      {/* Primary Details Grid */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Event Execution Context
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <span className="text-zinc-500 block mb-0.5">Actor Username</span>
            <span className="text-zinc-200 font-semibold">{log.actor_username || "system"}</span>
          </div>

          <div>
            <span className="text-zinc-500 block mb-0.5">Actor Role</span>
            <span className="text-zinc-200 uppercase">{log.actor_role || "—"}</span>
          </div>

          <div>
            <span className="text-zinc-500 block mb-0.5">Actor User ID</span>
            <span className="text-zinc-300 truncate block">{log.actor_id || "—"}</span>
          </div>

          <div>
            <span className="text-zinc-500 block mb-0.5">Client IP Address</span>
            <span className="text-zinc-300">{log.ip_address || "—"}</span>
          </div>

          <div>
            <span className="text-zinc-500 block mb-0.5">Target Resource Type</span>
            <span className="text-zinc-300 capitalize">{log.target_type || "—"}</span>
          </div>

          <div>
            <span className="text-zinc-500 block mb-0.5">Target Identifier</span>
            <span className="text-zinc-300 truncate block">{log.target_id || "—"}</span>
          </div>

          <div className="sm:col-span-2">
            <span className="text-zinc-500 block mb-0.5">Execution Timestamp</span>
            <span className="text-zinc-300">{formatDate(log.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Error Message if Failed */}
      {log.error_message && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-2">
            Failure Error Message
          </h2>
          <pre className="text-xs font-mono text-red-300 whitespace-pre-wrap">
            {log.error_message}
          </pre>
        </div>
      )}

      {/* Structured Change Details / Metadata JSON */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Sanitized Event Metadata (JSON)
        </h2>

        {log.details && Object.keys(log.details).length > 0 ? (
          <pre className="rounded-md border border-zinc-800 bg-zinc-950 p-4 text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed">
            {JSON.stringify(log.details, null, 2)}
          </pre>
        ) : (
          <div className="p-4 text-xs text-zinc-500 italic">
            No additional payload metadata recorded for this action.
          </div>
        )}
      </div>
    </div>
  );
}

