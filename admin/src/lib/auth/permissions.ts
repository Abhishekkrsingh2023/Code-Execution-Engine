import type { UserRole } from "@/types/user";

export type Permission =
  | "dashboard:access"
  | "users:view"
  | "users:manage"
  | "users:delete"
  | "audit:view"
  | "analytics:view"
  | "problems:view"
  | "problems:create"
  | "problems:edit"
  | "problems:delete";

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: [
    "dashboard:access",
    "users:view",
    "users:manage",
    "users:delete",
    "audit:view",
    "analytics:view",
    "problems:view",
    "problems:create",
    "problems:edit",
    "problems:delete",
  ],
  moderator: [
    "dashboard:access",
    "problems:view",
    "problems:create",
    "problems:edit",
    "problems:delete",
  ],
  user: [],
};

export function hasPermission(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function isStaff(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "moderator";
}

export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === "admin";
}

export function isModerator(role: UserRole | null | undefined): boolean {
  return role === "moderator";
}

