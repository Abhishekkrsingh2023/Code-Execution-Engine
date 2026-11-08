"use server";

import { redirect } from "next/navigation";
import { loginUser, logoutUser } from "@/lib/api/auth";

export interface LoginActionResult {
  error?: string;
  success?: boolean;
}

export async function loginAction(
  prevState: LoginActionResult | null,
  formData: FormData
): Promise<LoginActionResult> {
  const username_or_email = formData.get("username_or_email") as string;
  const password = formData.get("password") as string;

  if (!username_or_email || !password) {
    return { error: "Username or email and password are required." };
  }

  try {
    const response = await loginUser({ username_or_email, password });
    if (response.user.role === "user") {
      await logoutUser();
      return {
        error: "Access denied. Only moderators and administrators can access this console.",
      };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Authentication failed.";
    return { error: message };
  }

  redirect("/");
}

