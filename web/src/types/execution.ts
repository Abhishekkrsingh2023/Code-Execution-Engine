export type ExecutionMode = "run" | "submit";
export type SupportedLanguage = "c" | "cpp" | "java" | "python";

export interface TestCaseInput {
  input: string;
  expected_output: string;
  weight?: number;
}

export interface RunRequestBody {
  problem_id: number;
  user_code: string;
  language: SupportedLanguage;
  test_cases?: TestCaseInput[];
  time_limit?: number;
}

export interface SubmitRequestBody {
  problem_id: number;
  user_code: string;
  language: SupportedLanguage;
  time_limit?: number;
}

export interface CodeEnqueueResponse {
  message: string;
  submission: string; // UUID
  status: "queued" | "running";
  mode: ExecutionMode;
  streaming_url: string;
  polling_url: string;
}

export interface TestCaseVerdict {
  test_case?: number;
  status: "passed" | "failed" | "tle" | string;
  weight?: number;
  score?: number;
  output?: string;
  error?: string;
}

export interface SubmissionPollResponse {
  submission_id?: string;
  mode?: ExecutionMode;
  status: "queued" | "running" | "completed" | "failed" | "tle" | "compile_error" | string;
  output?: string;
  error?: string;
  results?: string | TestCaseVerdict[]; // JSON string from Redis or parsed array
  time_taken?: number;
  score?: number;
  max_score?: number;
  tests_passed?: number;
  total_tests?: number;
}

export interface UserSubmissionItem {
  id: string; // UUID
  user_id?: string | null;
  problem_id: number | null;
  problem_name: string | null;
  language: SupportedLanguage | string;
  status:
    | "accepted"
    | "wrong_answer"
    | "time_limit_exceeded"
    | "memory_limit_exceeded"
    | "compilation_error"
    | "runtime_error"
    | "queued"
    | "running"
    | "pending"
    | string;
  score: number;
  max_score: number;
  tests_passed: number;
  total_tests: number;
  execution_time: number | null;
  memory_used: number | null;
  source_code?: string | null;
  created_at: string;
}

export interface UserSubmissionListResponse {
  total: number;
  skip: number;
  limit: number;
  submissions: UserSubmissionItem[];
}


