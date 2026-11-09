import { serverFetch } from "@/lib/api/client";
import type { LeaderboardEntryResponse, LeaderboardResponse } from "@/types/user";

export async function getMyLeaderboardRank(): Promise<LeaderboardEntryResponse | null> {
  try {
    return await serverFetch<LeaderboardEntryResponse>("/api-v1/leaderboard/me", {
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

export async function getLeaderboard(skip = 0, limit = 50): Promise<LeaderboardResponse> {
  return serverFetch<LeaderboardResponse>(`/api-v1/leaderboard?skip=${skip}&limit=${limit}`, {
    cache: "no-store",
  });
}

