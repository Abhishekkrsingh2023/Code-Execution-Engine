"use client";

import { useState, useTransition } from "react";
import { Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { adminUpdateUserAction } from "./actions";
import type { AdminUserDetailResponse, UserRole, UserStatus } from "@/types/user";

interface UserEditDialogProps {
  user: AdminUserDetailResponse;
}

export function UserEditDialog({ user }: UserEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(user.name || "");
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<UserRole>(user.role);
  const [status, setStatus] = useState<UserStatus>(user.status);
  const [isEmailVerified, setIsEmailVerified] = useState(user.is_email_verified);
  const [isProtected, setIsProtected] = useState(user.is_protected);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await adminUpdateUserAction(user.id, {
        name: name.trim() || null,
        username: username.trim(),
        email: email.trim(),
        role,
        status,
        is_email_verified: isEmailVerified,
        is_protected: isProtected,
      });

      if (res.success) {
        setOpen(false);
      } else {
        setError(res.error || "Update failed");
      }
    });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Edit className="h-3.5 w-3.5 mr-1.5" />
        Edit Profile
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit User Profile</DialogTitle>
            <DialogDescription>
              Modify profile attributes, role assignments, and security flags for user @{user.username}.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mb-4 rounded-md border border-red-900/60 bg-red-950/30 p-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-3.5 text-xs">
            <div>
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                disabled={isPending}
              />
            </div>

            <div>
              <Label htmlFor="edit-username" required>
                Username
              </Label>
              <Input
                id="edit-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isPending}
              />
            </div>

            <div>
              <Label htmlFor="edit-email" required>
                Email Address
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isPending}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  id="edit-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  disabled={isPending || user.is_protected}
                >
                  <option value="user">User</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-status">Account Status</Label>
                <Select
                  id="edit-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as UserStatus)}
                  disabled={isPending || user.is_protected}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </Select>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isEmailVerified}
                  onChange={(e) => setIsEmailVerified(e.target.checked)}
                  disabled={isPending}
                  className="rounded border-zinc-700 bg-zinc-900"
                />
                <span className="text-zinc-300">Email verified</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isProtected}
                  onChange={(e) => setIsProtected(e.target.checked)}
                  disabled={isPending}
                  className="rounded border-zinc-700 bg-zinc-900"
                />
                <span className="text-zinc-300">Protected system account</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isPending} disabled={isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}

