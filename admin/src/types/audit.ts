export type AuditLogStatus = "success" | "failure" | "error";

export interface AuditLogResponse {
  id: string;
  actor_id: string | null;
  actor_username: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  status: AuditLogStatus | string;
  details: Record<string, unknown> | null;
  error_message: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogListResponse {
  total: number;
  skip: number;
  limit: number;
  logs: AuditLogResponse[];
}

