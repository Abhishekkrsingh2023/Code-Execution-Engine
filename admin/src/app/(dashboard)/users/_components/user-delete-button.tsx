"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { adminDeleteUserAction } from "./actions";

interface UserDeleteButtonProps {
  userId: string;
  username: string;
  isProtected?: boolean;
  redirectAfterDelete?: boolean;
}

export function UserDeleteButton({
  userId,
  username,
  isProtected = false,
  redirectAfterDelete = false,
}: UserDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (isProtected) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-zinc-600 cursor-not-allowed"
        title="Protected system account cannot be deleted"
        disabled
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    );
  }

  const handleDelete = () => {
    startTransition(async () => {
      const res = await adminDeleteUserAction(userId);
      if (res.success) {
        setOpen(false);
        if (redirectAfterDelete) {
          router.push("/users");
        }
      } else {
        alert(res.error || "Failed to delete user");
      }
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-red-950/30"
        title={`Delete user @${username}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete User Account"
        description={`Are you sure you want to delete user @${username}? This action is irreversible and permanently removes user access, records, and submissions.`}
        confirmLabel="Permanently Delete"
        variant="destructive"
        isLoading={isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

