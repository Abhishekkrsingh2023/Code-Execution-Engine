import { serverFetch } from "./client";
import type {
  ProblemListResponse,
  ProblemResponse,
  FullProblemResponse,
  FullProblemCreateRequest,
  ProblemUpdateRequest,
  ProblemStatus,
  TestCaseResponse,
  CommonProblemTemplateResponse,
  CommonProblemTemplateCreateRequest,
} from "@/types/problem";
import type { MessageResponse } from "@/types/api";

export async function listProblems(params: {
  skip?: number;
  limit?: number;
  difficulty?: string;
  category?: string;
  topic?: string;
  status?: string;
  search?: string;
} = {}): Promise<ProblemListResponse> {
  return await serverFetch<ProblemListResponse>("/api-v1/problems", {
    params: {
      skip: params.skip ?? 0,
      limit: params.limit ?? 20,
      difficulty: params.difficulty || undefined,
      category: params.category || undefined,
      topic: params.topic || undefined,
      status: params.status || undefined,
      search: params.search || undefined,
    },
  });
}

export async function getProblem(problemId: number): Promise<ProblemResponse> {
  return await serverFetch<ProblemResponse>(`/api-v1/problems/${problemId}`);
}

export async function getFullProblem(problemId: number): Promise<FullProblemResponse> {
  return await serverFetch<FullProblemResponse>(`/api-v1/problems/${problemId}/full`);
}

export async function getProblemTestCases(problemId: number): Promise<TestCaseResponse[]> {
  return await serverFetch<TestCaseResponse[]>(`/api-v1/problems/${problemId}/test-cases`);
}

export async function createFullProblem(
  payload: FullProblemCreateRequest
): Promise<FullProblemResponse> {
  return await serverFetch<FullProblemResponse>("/api-v1/problems/full", {
    method: "POST",
    body: payload,
  });
}

export async function updateProblem(
  problemId: number,
  payload: ProblemUpdateRequest
): Promise<ProblemResponse> {
  return await serverFetch<ProblemResponse>(`/api-v1/problems/${problemId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function updateProblemStatus(
  problemId: number,
  status: ProblemStatus
): Promise<ProblemResponse> {
  return await serverFetch<ProblemResponse>(`/api-v1/problems/${problemId}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export async function deleteProblem(problemId: number): Promise<MessageResponse> {
  return await serverFetch<MessageResponse>(`/api-v1/problems/${problemId}`, {
    method: "DELETE",
  });
}

export async function getCommonTemplate(
  problemId: number
): Promise<CommonProblemTemplateResponse> {
  return await serverFetch<CommonProblemTemplateResponse>(
    `/api-v1/problems/templates/common/${problemId}`
  );
}

export async function createOrUpdateCommonTemplate(
  payload: CommonProblemTemplateCreateRequest
): Promise<CommonProblemTemplateResponse> {
  return await serverFetch<CommonProblemTemplateResponse>(
    "/api-v1/problems/templates/common",
    {
      method: "POST",
      body: payload,
    }
  );
}

