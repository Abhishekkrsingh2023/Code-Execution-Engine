"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteContestAction } from "./actions";
import type { ContestStatus } from "@/types/contest";
import type { UserRole } from "@/types/user";

interface ContestDeleteButtonProps {
  contestId: number;
  contestTitle: string;
  status: ContestStatus;
  userRole?: UserRole;
  redirectAfterDelete?: boolean;
}

export function ContestDeleteButton({
  contestId,
  contestTitle,
  status,
  userRole = "moderator",
  redirectAfterDelete = false,
}: ContestDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Rule 7 & 10: Only admin can delete, and only for upcoming contests
  if (userRole !== "admin" || status !== "upcoming") {
    return null;
  }

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteContestAction(contestId);
      if (res.success) {
        setOpen(false);
        if (redirectAfterDelete) {
          router.push("/contests");
        }
      } else {
        alert(res.error || "Failed to delete contest");
      }
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-red-950/30"
        title="Delete Contest"
        aria-label={`Delete contest ${contestTitle}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete Contest"
        description={`Are you sure you want to delete contest #${contestId} ("${contestTitle}")? This action cannot be undone.`}
        confirmLabel="Delete Contest"
        variant="destructive"
        isLoading={isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

