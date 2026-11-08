import { serverFetch } from "./client";
import type {
  DashboardStatsResponse,
  UserStatsResponse,
  ProblemStatsResponse,
  SubmissionStatsResponse,
  SystemActivityStatsResponse,
} from "@/types/stats";

export async function getDashboardStats(days = 30): Promise<DashboardStatsResponse> {
  return await serverFetch<DashboardStatsResponse>("/api-v1/admin/stats", {
    params: { days },
  });
}

export async function getUserStats(days = 30): Promise<UserStatsResponse> {
  return await serverFetch<UserStatsResponse>("/api-v1/admin/stats/users", {
    params: { days },
  });
}

export async function getProblemStats(): Promise<ProblemStatsResponse> {
  return await serverFetch<ProblemStatsResponse>("/api-v1/admin/stats/problems");
}

export async function getSubmissionStats(days = 30): Promise<SubmissionStatsResponse> {
  return await serverFetch<SubmissionStatsResponse>("/api-v1/admin/stats/submissions", {
    params: { days },
  });
}

export async function getActivityStats(): Promise<SystemActivityStatsResponse> {
  return await serverFetch<SystemActivityStatsResponse>("/api-v1/admin/stats/activity");
}

