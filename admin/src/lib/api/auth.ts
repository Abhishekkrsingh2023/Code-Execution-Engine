import { serverFetch } from "./client";
import { setAuthCookiesFromHeaders, clearAuthCookies } from "../auth/session";
import type { UserLoginResponse, MessageResponse } from "@/types/api";
import type { UserResponse } from "@/types/user";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

export async function loginUser(credentials: {
  username_or_email: string;
  password?: string;
}): Promise<UserLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api-v1/users/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(credentials),
    cache: "no-store",
  });

  if (!response.ok) {
    let errorDetail = "Login failed";
    try {
      const errorData = await response.json();
      if (errorData?.detail) {
        errorDetail =
          typeof errorData.detail === "string"
            ? errorData.detail
            : JSON.stringify(errorData.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") || ""].filter(Boolean);

  if (setCookies.length > 0) {
    await setAuthCookiesFromHeaders(setCookies);
  }

  return (await response.json()) as UserLoginResponse;
}

export async function logoutUser(): Promise<MessageResponse> {
  try {
    await serverFetch<MessageResponse>("/api-v1/users/logout", {
      method: "POST",
    });
  } finally {
    await clearAuthCookies();
  }
  return { message: "Logged out successfully" };
}

export async function getMe(): Promise<UserResponse> {
  return await serverFetch<UserResponse>("/api-v1/users/me");
}

