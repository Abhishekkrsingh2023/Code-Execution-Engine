"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TablePaginationProps {
  total: number;
  skip: number;
  limit: number;
  itemName?: string;
}

export function TablePagination({
  total,
  skip,
  limit,
  itemName = "items",
}: TablePaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = Math.floor(skip / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startItem = total === 0 ? 0 : skip + 1;
  const endItem = Math.min(skip + limit, total);

  const createPageUrl = (newSkip: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("skip", String(newSkip));
    params.set("limit", String(limit));
    return `${pathname}?${params.toString()}`;
  };

  const hasPrev = skip > 0;
  const hasNext = skip + limit < total;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-2.5 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
      <div>
        Showing <span className="font-medium text-zinc-900 dark:text-zinc-100">{startItem}</span> to{" "}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{endItem}</span> of{" "}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{total}</span> {itemName}
      </div>

      <div className="flex items-center space-x-2">
        <span className="mr-2">
          Page {currentPage} of {totalPages}
        </span>

        {hasPrev ? (
          <Link href={createPageUrl(Math.max(0, skip - limit))}>
            <Button variant="outline" size="sm" className="h-7 px-2">
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Previous
            </Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" className="h-7 px-2" disabled>
            <ChevronLeft className="h-3.5 w-3.5 mr-1" />
            Previous
          </Button>
        )}

        {hasNext ? (
          <Link href={createPageUrl(skip + limit)}>
            <Button variant="outline" size="sm" className="h-7 px-2">
              Next
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" className="h-7 px-2" disabled>
            Next
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

