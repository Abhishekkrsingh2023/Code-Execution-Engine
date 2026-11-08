import { serverFetch } from "./client";
import type { AuditLogListResponse, AuditLogResponse } from "@/types/audit";

export async function listAuditLogs(params: {
  skip?: number;
  limit?: number;
  action?: string;
  actor_id?: string;
  actor_role?: string;
  target_type?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
} = {}): Promise<AuditLogListResponse> {
  return await serverFetch<AuditLogListResponse>("/api-v1/admin/audit-logs", {
    params: {
      skip: params.skip ?? 0,
      limit: params.limit ?? 20,
      action: params.action || undefined,
      actor_id: params.actor_id || undefined,
      actor_role: params.actor_role || undefined,
      target_type: params.target_type || undefined,
      status: params.status || undefined,
      start_date: params.start_date || undefined,
      end_date: params.end_date || undefined,
    },
  });
}

export async function getAuditLog(logId: string): Promise<AuditLogResponse> {
  return await serverFetch<AuditLogResponse>(`/api-v1/admin/audit-logs/${logId}`);
}

