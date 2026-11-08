import { serverFetch } from "./client";
import type {
  AdminUserListResponse,
  AdminUserDetailResponse,
  AdminUserResponse,
  AdminUpdateUserRequest,
  UserRole,
  UserStatus,
} from "@/types/user";
import type { MessageResponse } from "@/types/api";

export async function listAdminUsers(params: {
  skip?: number;
  limit?: number;
  role?: string;
  status?: string;
  search?: string;
} = {}): Promise<AdminUserListResponse> {
  return await serverFetch<AdminUserListResponse>("/api-v1/admin/users", {
    params: {
      skip: params.skip ?? 0,
      limit: params.limit ?? 20,
      role: params.role || undefined,
      status: params.status || undefined,
      search: params.search || undefined,
    },
  });
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetailResponse> {
  return await serverFetch<AdminUserDetailResponse>(`/api-v1/admin/users/${userId}`);
}

export async function updateUserRole(userId: string, role: UserRole): Promise<AdminUserResponse> {
  return await serverFetch<AdminUserResponse>(`/api-v1/admin/users/${userId}/role`, {
    method: "PATCH",
    body: { role },
  });
}

export async function updateUserStatus(userId: string, status: UserStatus): Promise<AdminUserResponse> {
  return await serverFetch<AdminUserResponse>(`/api-v1/admin/users/${userId}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export async function adminUpdateUser(
  userId: string,
  payload: AdminUpdateUserRequest
): Promise<AdminUserResponse> {
  return await serverFetch<AdminUserResponse>(`/api-v1/admin/users/${userId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function adminDeleteUser(userId: string): Promise<MessageResponse> {
  return await serverFetch<MessageResponse>(`/api-v1/admin/users/${userId}`, {
    method: "DELETE",
  });
}

