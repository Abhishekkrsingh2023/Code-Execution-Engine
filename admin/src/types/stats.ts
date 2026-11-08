import type { ProblemResponse } from "./problem";
import type { AuditLogResponse } from "./audit";

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

export interface ModeratorProblemCount {
  moderator_id: string;
  username: string;
  count: number;
}

export interface UserStatsResponse {
  total_users: number;
  by_role: Record<string, number>;
  by_status: Record<string, number>;
  new_registrations_in_period: number;
  registrations_trend: TimeSeriesPoint[];
}

export interface ProblemStatsResponse {
  total_problems: number;
  total_including_deleted: number;
  by_difficulty: Record<string, number>;
  by_category: Record<string, number>;
  by_topic: Record<string, number>;
  by_status: Record<string, number>;
  problems_by_moderator: ModeratorProblemCount[];
  recently_created: ProblemResponse[];
  recently_updated: ProblemResponse[];
  recently_deleted: ProblemResponse[];
}

export interface SubmissionStatsResponse {
  total_submissions: number;
  accepted: number;
  rejected: number;
  compilation_errors: number;
  runtime_errors: number;
  time_limit_exceeded: number;
  memory_limit_exceeded: number;
  success_rate: number;
  submissions_trend: TimeSeriesPoint[];
}

export interface SystemActivityStatsResponse {
  recent_admin_actions: AuditLogResponse[];
  recent_moderator_activity: AuditLogResponse[];
  user_creation_trend: TimeSeriesPoint[];
  problem_creation_trend: TimeSeriesPoint[];
}

export interface DashboardStatsResponse {
  users: UserStatsResponse;
  problems: ProblemStatsResponse;
  submissions: SubmissionStatsResponse;
  activity: SystemActivityStatsResponse;
}

