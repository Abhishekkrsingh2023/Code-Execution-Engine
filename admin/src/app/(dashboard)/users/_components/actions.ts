"use server";

import { revalidatePath } from "next/cache";
import {
  updateUserRole,
  updateUserStatus,
  adminUpdateUser,
  adminDeleteUser,
} from "@/lib/api/users";
import type {
  AdminUpdateUserRequest,
  UserRole,
  UserStatus,
} from "@/types/user";

export async function updateUserRoleAction(userId: string, role: UserRole) {
  try {
    await updateUserRole(userId, role);
    revalidatePath("/users");
    revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to change user role";
    return { success: false, error: message };
  }
}

export async function updateUserStatusAction(userId: string, status: UserStatus) {
  try {
    await updateUserStatus(userId, status);
    revalidatePath("/users");
    revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to change user status";
    return { success: false, error: message };
  }
}

export async function adminUpdateUserAction(
  userId: string,
  payload: AdminUpdateUserRequest
) {
  try {
    await adminUpdateUser(userId, payload);
    revalidatePath("/users");
    revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update user";
    return { success: false, error: message };
  }
}

export async function adminDeleteUserAction(userId: string) {
  try {
    await adminDeleteUser(userId);
    revalidatePath("/users");
    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete user";
    return { success: false, error: message };
  }
}

