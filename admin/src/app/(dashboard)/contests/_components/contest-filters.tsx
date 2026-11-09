"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function ContestFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange("search", search.trim());
  };

  const handleClearFilters = () => {
    setSearch("");
    startTransition(() => {
      router.push(pathname);
    });
  };

  const hasActiveFilters =
    Boolean(searchParams.get("search")) || Boolean(searchParams.get("status"));

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pb-4">
      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
        <Input
          type="text"
          placeholder="Search contests by title or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 text-xs h-9"
        />
      </form>

      {/* Status Filter */}
      <div className="w-full sm:w-40">
        <Select
          value={searchParams.get("status") || ""}
          onChange={(e) => handleFilterChange("status", e.target.value)}
          className="text-xs h-9"
          aria-label="Filter by contest status"
        >
          <option value="">All Statuses</option>
          <option value="upcoming">Upcoming</option>
          <option value="live">Live</option>
          <option value="ended">Ended</option>
        </Select>
      </div>

      {/* Reset Button */}
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
          Clear
        </Button>
      )}
    </div>
  );
}

