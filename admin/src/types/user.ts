export type UserRole = "user" | "moderator" | "admin";
export type UserStatus = "active" | "inactive" | "suspended";

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  is_email_verified: boolean;
  total_score: number;
  problems_solved: number;
  created_at: string;
  updated_at?: string;
}

export interface AdminUserResponse {
  id: string;
  name: string | null;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  is_email_verified: boolean;
  is_protected: boolean;
  has_password: boolean;
  created_at: string;
  total_score: number;
  problems_solved: number;
  submissions_count: number;
  problems_created_count: number;
}

export interface SubmissionSummary {
  id: string;
  problem_id: number;
  language: string;
  status: string;
  score: number;
  created_at: string;
}

export interface AuditActionSummary {
  id: string;
  action: string;
  status: string;
  created_at: string;
  ip_address?: string | null;
}

export interface AdminUserDetailResponse extends AdminUserResponse {
  recent_submissions: SubmissionSummary[];
  recent_audit_actions: AuditActionSummary[];
}

export interface AdminUserListResponse {
  total: number;
  skip: number;
  limit: number;
  users: AdminUserResponse[];
}

export interface AdminUpdateUserRoleRequest {
  role: UserRole;
}

export interface AdminUpdateUserStatusRequest {
  status: UserStatus;
}

export interface AdminUpdateUserRequest {
  name?: string | null;
  username?: string | null;
  email?: string | null;
  password?: string | null;
  role?: UserRole | null;
  status?: UserStatus | null;
  is_email_verified?: boolean | null;
  is_protected?: boolean | null;
}

