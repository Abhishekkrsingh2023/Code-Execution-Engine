import { serverFetch } from "@/lib/api/client";
import type { FullProblemResponse, ProblemListResponse, ProblemResponse, TestCaseResponse } from "@/types/problem";

export interface ListProblemsParams {
  skip?: number;
  limit?: number;
  difficulty?: string;
  category?: string;
  topic?: string;
  search?: string;
}

export async function listProblems(params: ListProblemsParams = {}): Promise<ProblemListResponse> {
  const query = new URLSearchParams();
  if (params.skip !== undefined) query.set("skip", String(params.skip));
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.difficulty) query.set("difficulty", params.difficulty);
  if (params.category) query.set("category", params.category);
  if (params.topic) query.set("topic", params.topic);
  if (params.search) query.set("search", params.search);

  const qs = query.toString();
  const path = `/api-v1/problems${qs ? `?${qs}` : ""}`;

  return serverFetch<ProblemListResponse>(path, {
    cache: "no-store",
  });
}

export async function getProblem(id: number): Promise<ProblemResponse> {
  return serverFetch<ProblemResponse>(`/api-v1/problems/${id}`, {
    cache: "no-store",
  });
}

export async function getFullProblem(id: number): Promise<FullProblemResponse> {
  return serverFetch<FullProblemResponse>(`/api-v1/problems/${id}/full`, {
    cache: "no-store",
  });
}

export async function getProblemTestCases(id: number): Promise<TestCaseResponse[]> {
  return serverFetch<TestCaseResponse[]>(`/api-v1/problems/${id}/test-cases`, {
    cache: "no-store",
  });
}

