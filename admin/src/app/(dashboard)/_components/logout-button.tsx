"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "./actions";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        startTransition(async () => {
          await logoutAction();
        });
      }}
      disabled={isPending}
      className="flex items-center gap-2 rounded px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
      title="Sign out of console"
    >
      <LogOut className="h-3.5 w-3.5" />
      <span>{isPending ? "Signing out..." : "Sign out"}</span>
    </button>
  );
}

