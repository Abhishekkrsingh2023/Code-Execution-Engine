export type UserRole = "user" | "moderator" | "admin";
export type UserStatus = "active" | "inactive" | "suspended";

export interface UserResponse {
  id: string;
  name: string | null;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  is_email_verified: boolean;
  is_protected: boolean;
  has_password: boolean;
  total_score: number;
  problems_solved: number;
  created_at: string;
}

export interface UserLoginResponse {
  message: string;
  user: UserResponse;
  auth_method: string;
}

export interface OTPResponse {
  message: string;
  email: string;
  expires_in_seconds: number;
}

export interface TokenRefreshResponse {
  message: string;
}

export interface MessageResponse {
  message: string;
}

export interface UsernameAvailabilityResponse {
  username: string;
  is_available?: boolean;
  available?: boolean;
}

export interface LeaderboardEntryResponse {
  rank: number;
  user_id: string;
  username: string;
  total_score: number;
  problems_solved: number;
  submissions_count: number;
  created_at: string | null;
}

export interface LeaderboardResponse {
  total: number;
  skip: number;
  limit: number;
  users: LeaderboardEntryResponse[];
  my_rank: LeaderboardEntryResponse | null;
}

