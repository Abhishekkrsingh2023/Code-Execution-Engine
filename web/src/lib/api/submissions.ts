import { serverFetch } from "@/lib/api/client";
import type { UserSubmissionListResponse, UserSubmissionItem } from "@/types/execution";

export interface GetSubmissionsParams {
  skip?: number;
  limit?: number;
  problem_id?: number;
  status?: string;
}

export async function getMySubmissions(
  params: GetSubmissionsParams = {}
): Promise<UserSubmissionListResponse> {
  const query = new URLSearchParams();
  if (params.skip !== undefined) query.set("skip", params.skip.toString());
  if (params.limit !== undefined) query.set("limit", params.limit.toString());
  if (params.problem_id !== undefined) query.set("problem_id", params.problem_id.toString());
  if (params.status) query.set("status", params.status);

  const queryString = query.toString();
  const url = `/api-v1/users/me/submissions${queryString ? `?${queryString}` : ""}`;

  return serverFetch<UserSubmissionListResponse>(url, {
    cache: "no-store",
  });
}

export async function getMySubmissionDetail(
  submissionId: string
): Promise<UserSubmissionItem> {
  return serverFetch<UserSubmissionItem>(`/api-v1/users/me/submissions/${submissionId}`, {
    cache: "no-store",
  });
}

