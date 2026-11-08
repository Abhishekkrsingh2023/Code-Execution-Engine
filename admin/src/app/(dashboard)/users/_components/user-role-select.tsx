"use client";

import { useState, useTransition } from "react";
import { updateUserRoleAction } from "./actions";
import type { UserRole } from "@/types/user";

interface UserRoleSelectProps {
  userId: string;
  initialRole: UserRole;
  isProtected?: boolean;
}

export function UserRoleSelect({
  userId,
  initialRole,
  isProtected = false,
}: UserRoleSelectProps) {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRole = e.target.value as UserRole;
    setRole(nextRole);
    startTransition(async () => {
      const res = await updateUserRoleAction(userId, nextRole);
      if (!res.success) {
        setRole(initialRole);
        alert(res.error || "Failed to update role");
      }
    });
  };

  return (
    <select
      value={role}
      onChange={handleChange}
      disabled={isPending || isProtected}
      aria-label="Change user role"
      className="h-7 rounded border border-zinc-700 bg-zinc-900 px-2 text-[11px] font-medium text-zinc-200 transition-colors hover:border-zinc-600 focus:outline-hidden focus:ring-1 focus:ring-zinc-400 disabled:opacity-50 cursor-pointer"
    >
      <option value="user">User</option>
      <option value="moderator">Moderator</option>
      <option value="admin">Admin</option>
    </select>
  );
}

