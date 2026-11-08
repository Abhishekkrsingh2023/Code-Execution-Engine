"use client";

import { useState, useTransition } from "react";
import { updateUserStatusAction } from "./actions";
import type { UserStatus } from "@/types/user";

interface UserStatusSelectProps {
  userId: string;
  initialStatus: UserStatus;
  isProtected?: boolean;
}

export function UserStatusSelect({
  userId,
  initialStatus,
  isProtected = false,
}: UserStatusSelectProps) {
  const [status, setStatus] = useState<UserStatus>(initialStatus);
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextStatus = e.target.value as UserStatus;
    setStatus(nextStatus);
    startTransition(async () => {
      const res = await updateUserStatusAction(userId, nextStatus);
      if (!res.success) {
        setStatus(initialStatus);
        alert(res.error || "Failed to update status");
      }
    });
  };

  return (
    <select
      value={status}
      onChange={handleChange}
      disabled={isPending || isProtected}
      aria-label="Change user status"
      className="h-7 rounded border border-zinc-700 bg-zinc-900 px-2 text-[11px] font-medium text-zinc-200 transition-colors hover:border-zinc-600 focus:outline-hidden focus:ring-1 focus:ring-zinc-400 disabled:opacity-50 cursor-pointer"
    >
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
      <option value="suspended">Suspended</option>
    </select>
  );
}

