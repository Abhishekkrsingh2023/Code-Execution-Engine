"use server";

import { revalidatePath } from "next/cache";
import { serverFetch, ApiError } from "@/lib/api/client";
import type { UserResponse } from "@/types/user";

export interface ProfileActionResult {
  success?: boolean;
  message?: string;
  error?: string;
}

export async function updateProfileAction(
  _prevState: ProfileActionResult | null,
  formData: FormData
): Promise<ProfileActionResult> {
  const name = String(formData.get("name") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const currentPassword = String(formData.get("current_password") || "");
  const newPassword = String(formData.get("new_password") || "");
  const confirmPassword = String(formData.get("confirm_password") || "");

  if (newPassword) {
    if (newPassword.length < 6) {
      return { error: "New password must be at least 6 characters." };
    }
    if (newPassword !== confirmPassword) {
      return { error: "New passwords do not match." };
    }
  }

  const payload: {
    name?: string | null;
    username?: string;
    password?: string;
    current_password?: string;
  } = {};

  if (name !== undefined) {
    payload.name = name || null;
  }
  if (username) {
    payload.username = username;
  }
  if (newPassword) {
    payload.password = newPassword;
    if (currentPassword) {
      payload.current_password = currentPassword;
    }
  }

  try {
    await serverFetch<UserResponse>("/api-v1/users/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    revalidatePath("/profile");
    return { success: true, message: "Profile updated successfully." };
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: err.message };
    }
    return { error: "Failed to update profile details. Please try again." };
  }
}

