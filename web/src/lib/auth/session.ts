import { serverFetch } from "@/lib/api/client";
import type { UserResponse } from "@/types/user";

export async function getCurrentUser(): Promise<UserResponse | null> {
  try {
    const user = await serverFetch<UserResponse>("/api-v1/users/me", {
      cache: "no-store",
    });
    return user;
  } catch {
    return null;
  }
}

