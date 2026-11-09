export type ContestStatus = "upcoming" | "live" | "ended";

export interface ContestProblem {
  id: number;
  problem_id: number;
  title: string;
  difficulty: string;
  points: number;
  position: number;
}

export interface ContestSampleTestCase {
  id?: number | string;
  input?: string;
  input_data?: string;
  expected_output?: string;
  weight?: number;
}

export interface ContestProblemDetail extends ContestProblem {
  description: string;
  time_limit: number;
  memory_limit: number;
  sample_test_cases: ContestSampleTestCase[];
}

export interface ContestResponse {
  id: number;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  status: ContestStatus;
  penalty_minutes: number;
  participant_count: number;
  problem_count: number;
  is_registered: boolean;
  created_by: string | null;
  created_at: string;
  server_time: string;
  problems: ContestProblem[];
}

export interface ContestListResponse {
  total: number;
  skip: number;
  limit: number;
  server_time: string;
  contests: ContestResponse[];
}

export interface ContestCreateRequest {
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  penalty_minutes?: number;
  problem_ids: number[];
}

export interface ContestUpdateRequest {
  title?: string;
  description?: string | null;
  start_time?: string;
  end_time?: string;
  penalty_minutes?: number;
  problem_ids?: number[];
}

export interface ContestProblemScore {
  problem_id: number;
  score: number;
  is_solved: boolean;
  attempts: number;
  solved_time_seconds: number | null;
  penalty_seconds: number;
}

export interface ContestLeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  score: number;
  problems_solved: number;
  penalty_seconds: number;
  problems?: ContestProblemScore[];
  problem_scores?: Record<string, ContestProblemScore>;
  last_accepted_at: string | null;
}

export interface ContestLeaderboardResponse {
  contest_id: number;
  contest_title?: string;
  title?: string;
  status: ContestStatus;
  server_time: string;
  total_participants: number;
  leaderboard?: ContestLeaderboardEntry[];
  entries?: ContestLeaderboardEntry[];
}

