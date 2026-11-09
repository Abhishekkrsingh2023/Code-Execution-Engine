export type ProblemDifficulty = "easy" | "medium" | "hard";
export type ProblemStatus = "published" | "unpublished" | "draft" | "archived";

export interface ProblemResponse {
  id: number;
  problem_code: number | null;
  title: string;
  description: string;
  difficulty: ProblemDifficulty;
  category: string;
  topic: string;
  status: ProblemStatus;
  time_limit: number;
  memory_limit: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

export interface ProblemListResponse {
  total: number;
  skip: number;
  limit: number;
  problems: ProblemResponse[];
}

export interface TestCaseResponse {
  id: number;
  problem_id: number;
  input: string;
  expected_output: string;
  is_sample: boolean;
  weight: number;
}

export interface ProblemTemplateResponse {
  problem_id: number;
  language: string;
  boilerplate_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface FullProblemResponse {
  problem: ProblemResponse;
  problem_code: number;
  problem_id: number | null;
  run_test_cases: Array<{
    id?: number | string;
    input: string;
    expected_output: string;
    weight?: number;
  }>;
  templates: ProblemTemplateResponse[];
  test_cases_count: number;
}

