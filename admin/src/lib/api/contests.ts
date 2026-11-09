import { serverFetch } from "./client";
import type {
  ContestListResponse,
  ContestResponse,
  ContestCreateRequest,
  ContestUpdateRequest,
  ContestLeaderboardResponse,
} from "@/types/contest";
import type { MessageResponse } from "@/types/api";

export async function listContests(params: {
  skip?: number;
  limit?: number;
  status?: string;
  search?: string;
} = {}): Promise<ContestListResponse> {
  return await serverFetch<ContestListResponse>("/api-v1/contests", {
    params: {
      skip: params.skip ?? 0,
      limit: params.limit ?? 20,
      status: params.status || undefined,
      search: params.search || undefined,
    },
  });
}

export async function getContest(contestId: number): Promise<ContestResponse> {
  return await serverFetch<ContestResponse>(`/api-v1/contests/${contestId}`);
}

export async function createContest(
  payload: ContestCreateRequest
): Promise<ContestResponse> {
  return await serverFetch<ContestResponse>("/api-v1/contests", {
    method: "POST",
    body: payload,
  });
}

export async function updateContest(
  contestId: number,
  payload: ContestUpdateRequest
): Promise<ContestResponse> {
  return await serverFetch<ContestResponse>(`/api-v1/contests/${contestId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteContest(contestId: number): Promise<MessageResponse> {
  return await serverFetch<MessageResponse>(`/api-v1/contests/${contestId}`, {
    method: "DELETE",
  });
}

export async function getContestLeaderboard(
  contestId: number,
  params: { skip?: number; limit?: number } = {}
): Promise<ContestLeaderboardResponse> {
  return await serverFetch<ContestLeaderboardResponse>(
    `/api-v1/contests/${contestId}/leaderboard`,
    {
      params: {
        skip: params.skip ?? 0,
        limit: params.limit ?? 50,
      },
    }
  );
}

