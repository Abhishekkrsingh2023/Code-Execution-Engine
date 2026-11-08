"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function AuditFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [action, setAction] = useState(searchParams.get("action") || "");
  const [isPending, startTransition] = useTransition();

  const handleFilterChange = (key: string, val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("skip", "0");
    if (val) {
      params.set(key, val);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange("action", action.trim());
  };

  const handleClearFilters = () => {
    setAction("");
    startTransition(() => {
      router.push(pathname);
    });
  };

  const hasActiveFilters =
    Boolean(searchParams.get("action")) ||
    Boolean(searchParams.get("actor_role")) ||
    Boolean(searchParams.get("target_type")) ||
    Boolean(searchParams.get("status"));

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pb-4">
      <form onSubmit={handleActionSubmit} className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
        <Input
          type="text"
          placeholder="Filter by action name (e.g. user_role_change, problem_create)..."
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="pl-8 text-xs h-9"
        />
      </form>

      <div className="w-full sm:w-36">
        <Select
          value={searchParams.get("actor_role") || ""}
          onChange={(e) => handleFilterChange("actor_role", e.target.value)}
          className="text-xs h-9"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="moderator">Moderator</option>
          <option value="user">User</option>
        </Select>
      </div>

      <div className="w-full sm:w-36">
        <Select
          value={searchParams.get("target_type") || ""}
          onChange={(e) => handleFilterChange("target_type", e.target.value)}
          className="text-xs h-9"
        >
          <option value="">All Targets</option>
          <option value="user">User</option>
          <option value="problem">Problem</option>
        </Select>
      </div>

      <div className="w-full sm:w-36">
        <Select
          value={searchParams.get("status") || ""}
          onChange={(e) => handleFilterChange("status", e.target.value)}
          className="text-xs h-9"
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="error">Error</option>
        </Select>
      </div>

      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="h-9 px-2 text-xs text-zinc-400 hover:text-zinc-100"
          disabled={isPending}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Reset
        </Button>
      )}
    </div>
  );
}

