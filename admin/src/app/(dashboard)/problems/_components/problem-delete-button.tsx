"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteProblemAction } from "./actions";

interface ProblemDeleteButtonProps {
  problemId: number;
  problemTitle: string;
  redirectAfterDelete?: boolean;
}

export function ProblemDeleteButton({
  problemId,
  problemTitle,
  redirectAfterDelete = false,
}: ProblemDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteProblemAction(problemId);
      if (res.success) {
        setOpen(false);
        if (redirectAfterDelete) {
          router.push("/problems");
        }
      } else {
        alert(res.error || "Failed to delete problem");
      }
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-red-950/30"
        title="Delete Problem"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete Problem"
        description={`Are you sure you want to delete problem #${problemId} ("${problemTitle}")? This will soft-delete the problem and prevent users from accessing it.`}
        confirmLabel="Delete Problem"
        variant="destructive"
        isLoading={isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

