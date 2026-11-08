import type { UserResponse } from "./user";

export interface MessageResponse {
  message: string;
}

export interface UserLoginResponse {
  message: string;
  user: UserResponse;
  auth_method: string;
}

export interface TokenRefreshResponse {
  message: string;
}

export interface ApiError {
  detail: string | Array<{ loc: (string | number)[]; msg: string; type: string }>;
  status?: number;
}

