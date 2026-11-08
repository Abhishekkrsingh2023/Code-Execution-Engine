export type ProblemDifficulty = "easy" | "medium" | "hard";
export type ProblemStatus = "draft" | "published" | "unpublished" | "archived";

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

export interface TestCaseItem {
  input: string;
  expected_output: string;
  is_sample?: boolean;
  weight?: number;
}

export interface TestCaseResponse {
  id: number;
  problem_id: number;
  input: string;
  expected_output: string;
  is_sample: boolean;
  weight: number;
}

export interface ProblemTemplateItem {
  language: string;
  boilerplate_code?: string | null;
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
  problem_id?: number | null;
  run_test_cases: TestCaseItem[];
  templates: ProblemTemplateResponse[];
  test_cases_count: number;
}

export interface FullProblemCreateRequest {
  title: string;
  description: string;
  difficulty?: ProblemDifficulty;
  category?: string;
  topic?: string;
  time_limit?: number;
  memory_limit?: number;
  status?: ProblemStatus;
  problem_code?: number | null;
  problem_id?: number | null;
  run_test_cases?: TestCaseItem[];
  submit_test_cases?: TestCaseItem[];
  templates?: ProblemTemplateItem[];
}

export interface ProblemUpdateRequest {
  title?: string;
  description?: string;
  difficulty?: ProblemDifficulty;
  category?: string;
  topic?: string;
  time_limit?: number;
  memory_limit?: number;
  status?: ProblemStatus;
}

export interface ProblemStatusUpdateRequest {
  status: ProblemStatus;
}

export interface CommonProblemTemplateResponse {
  problem_id: number;
  problem_statement: string;
  time_limit: number;
  run_test_cases: TestCaseItem[];
  submit_test_cases: TestCaseItem[];
  created_at: string;
  updated_at: string;
  templates: ProblemTemplateResponse[];
}

export interface CommonProblemTemplateCreateRequest {
  problem_id: number;
  problem_statement: string;
  time_limit?: number;
  run_test_cases: TestCaseItem[];
  submit_test_cases: TestCaseItem[];
}

