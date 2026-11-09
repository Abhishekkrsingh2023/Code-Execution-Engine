"use client";

import Link from "next/link";
import { LogIn, X, ShieldAlert } from "lucide-react";

interface GuestLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: "run" | "submit";
  problemId: number;
}

export function GuestLoginModal({
  isOpen,
  onClose,
  actionType,
  problemId,
}: GuestLoginModalProps) {
  if (!isOpen) return null;

  const nextUrl = `/problems/${problemId}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-modal-title"
    >
      <div className="relative w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 id="guest-modal-title" className="text-sm font-semibold text-[var(--foreground)]">
              Authentication Required
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Log in to {actionType === "submit" ? "submit solutions" : "run code"}
            </p>
          </div>
        </div>

        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed mb-6">
          You must be logged in to execute code against our sandbox containers. Your draft code will be saved in your browser so you won&apos;t lose any progress.
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <Link
            href={`/login?next=${encodeURIComponent(nextUrl)}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--brand)] text-[var(--brand-foreground)] text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign in to continue</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

