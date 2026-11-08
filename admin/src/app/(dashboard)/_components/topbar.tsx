import { LogoutButton } from "./logout-button";
import { StatusBadge } from "@/components/shared/status-badge";
import type { UserResponse } from "@/types/user";

interface TopbarProps {
  user: UserResponse | null;
}

export function Topbar({ user }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-6 backdrop-blur-xs">
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500 font-mono">
          Environment: <span className="text-zinc-300 font-medium">{process.env.NODE_ENV || "development"}</span>
        </span>
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col text-right">
              <span className="text-xs font-semibold text-zinc-200 leading-none">
                {user.name || user.username}
              </span>
              <span className="text-[11px] text-zinc-500 leading-none mt-1 font-mono">
                {user.email}
              </span>
            </div>
            <StatusBadge type="role" value={user.role} />
          </div>
        ) : (
          <span className="text-xs text-zinc-500">Authenticated Staff</span>
        )}

        <div className="h-4 w-px bg-zinc-800" />
        <LogoutButton />
      </div>
    </header>
  );
}

