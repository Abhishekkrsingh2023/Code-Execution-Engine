import { serverFetch } from "./client";
import type {
  ContestListResponse,
  ContestResponse,
  ContestProblemResponse,
  ContestProblemDetailResponse,
  ContestParticipantResponse,
  ContestLeaderboardResponse,
  ContestLeaderboardEntry,
} from "@/types/contest";

export async function listContests(params: {
  skip?: number;
  limit?: number;
  status?: string;
  search?: string;
} = {}): Promise<ContestListResponse> {
  const query = new URLSearchParams();
  if (params.skip !== undefined) query.set("skip", String(params.skip));
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.status) query.set("status", params.status);
  if (params.search) query.set("search", params.search);

  const qs = query.toString();
  const path = `/api-v1/contests${qs ? `?${qs}` : ""}`;

  return serverFetch<ContestListResponse>(path, {
    cache: "no-store",
  });
}

export async function getContest(contestId: number): Promise<ContestResponse> {
  return serverFetch<ContestResponse>(`/api-v1/contests/${contestId}`, {
    cache: "no-store",
  });
}

export async function registerContest(
  contestId: number
): Promise<ContestParticipantResponse> {
  return serverFetch<ContestParticipantResponse>(
    `/api-v1/contests/${contestId}/register`,
    {
      method: "POST",
    }
  );
}

export async function unregisterContest(
  contestId: number
): Promise<{ message: string }> {
  return serverFetch<{ message: string }>(
    `/api-v1/contests/${contestId}/unregister`,
    {
      method: "DELETE",
    }
  );
}

export async function getContestProblems(
  contestId: number
): Promise<ContestProblemResponse[]> {
  return serverFetch<ContestProblemResponse[]>(
    `/api-v1/contests/${contestId}/problems`,
    {
      cache: "no-store",
    }
  );
}

export async function getContestProblemDetail(
  contestId: number,
  problemId: number
): Promise<ContestProblemDetailResponse> {
  return serverFetch<ContestProblemDetailResponse>(
    `/api-v1/contests/${contestId}/problems/${problemId}`,
    {
      cache: "no-store",
    }
  );
}

export async function getContestLeaderboard(
  contestId: number,
  params: { skip?: number; limit?: number } = {}
): Promise<ContestLeaderboardResponse> {
  const query = new URLSearchParams();
  if (params.skip !== undefined) query.set("skip", String(params.skip));
  if (params.limit !== undefined) query.set("limit", String(params.limit));

  const qs = query.toString();
  const path = `/api-v1/contests/${contestId}/leaderboard${qs ? `?${qs}` : ""}`;

  return serverFetch<ContestLeaderboardResponse>(path, {
    cache: "no-store",
  });
}

export async function getContestMyRank(
  contestId: number
): Promise<ContestLeaderboardEntry> {
  return serverFetch<ContestLeaderboardEntry>(
    `/api-v1/contests/${contestId}/leaderboard/me`,
    {
      cache: "no-store",
    }
  );
}
