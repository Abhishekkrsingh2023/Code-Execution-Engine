"use client";

import { useActionState, useState } from "react";
import { updateProfileAction } from "../actions";
import type { UserResponse } from "@/types/user";
import { CheckCircle2, AlertCircle, Save, KeyRound } from "lucide-react";

interface ProfileEditFormProps {
  user: UserResponse;
}

export function ProfileEditForm({ user }: ProfileEditFormProps) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, null);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 shadow-xs">
      <div className="border-b border-[var(--border)] pb-4 mb-6">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Account Details
        </h2>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
          Update your public display name, handle, and security credentials.
        </p>
      </div>

      {state?.success && (
        <div className="mb-6 flex items-center gap-2 p-3 rounded-md bg-[var(--easy-bg)] border border-[var(--easy-border)] text-[var(--easy)] text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{state.message || "Profile updated successfully."}</span>
        </div>
      )}

      {state?.error && (
        <div className="mb-6 flex items-start gap-2 p-3 rounded-md bg-[var(--hard-bg)] border border-[var(--hard-border)] text-[var(--hard)] text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{state.error}</span>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="name"
              className="block text-xs font-medium text-[var(--foreground)] mb-1.5"
            >
              Display Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={user.name || ""}
              placeholder="Alice Smith"
              className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <div>
            <label
              htmlFor="username"
              className="block text-xs font-medium text-[var(--foreground)] mb-1.5"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              defaultValue={user.username}
              placeholder="alice_dev"
              className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="email"
              className="block text-xs font-medium text-[var(--foreground)]"
            >
              Email Address
            </label>
            <span className="text-[10px] text-[var(--muted-foreground)]">Non-editable</span>
          </div>
          <input
            id="email"
            type="email"
            disabled
            value={user.email}
            className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--muted)]/50 text-xs text-[var(--muted-foreground)] cursor-not-allowed"
          />
        </div>

        {/* Change Password Toggle */}
        <div className="pt-2">
          {!showPasswordSection ? (
            <button
              type="button"
              onClick={() => setShowPasswordSection(true)}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--brand)] hover:underline cursor-pointer font-medium"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{user.has_password ? "Change password" : "Set account password"}</span>
            </button>
          ) : (
            <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--foreground)]">
                  {user.has_password ? "Change Password" : "Set Password"}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPasswordSection(false)}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {user.has_password && (
                <div>
                  <label
                    htmlFor="current_password"
                    className="block text-xs font-medium text-[var(--foreground)] mb-1"
                  >
                    Current Password
                  </label>
                  <input
                    id="current_password"
                    name="current_password"
                    type="password"
                    placeholder="••••••••"
                    className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="new_password"
                  className="block text-xs font-medium text-[var(--foreground)] mb-1"
                >
                  New Password <span className="text-[var(--muted-foreground)]">(min. 6 characters)</span>
                </label>
                <input
                  id="new_password"
                  name="new_password"
                  type="password"
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm_password"
                  className="block text-xs font-medium text-[var(--foreground)] mb-1"
                >
                  Confirm New Password
                </label>
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-[var(--border)] flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-[var(--brand)] text-[var(--brand-foreground)] text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isPending ? "Saving changes..." : "Save Changes"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

