import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { logoutAction } from "@/lib/auth/actions";
import type { UserResponse } from "@/types/user";
import { User, LogOut } from "lucide-react";

interface NavbarProps {
  user: UserResponse | null;
}

export function Navbar({ user }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-13 flex items-center justify-between">
        {/* Left: Brand & Nav links */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-90 transition-opacity"
            aria-label="Code0 Home"
          >
            <Image
              src="/Code0.png"
              alt="Code0"
              width={64}
              height={32}
              className="h-6 w-auto object-contain"
              priority
            />
          </Link>
          <nav className="flex items-center gap-4 text-xs sm:text-sm font-medium">
            <Link
              href="/problems"
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              Problems
            </Link>
            <Link
              href="/contests"
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              Contests
            </Link>
          </nav>
        </div>

        {/* Right: Theme Toggle & Auth State */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/profile"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] border border-[var(--border)] transition-colors"
                title="View Profile"
              >
                <User className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                <span className="max-w-[120px] truncate">{user.username}</span>
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer"
                  title="Log out"
                  aria-label="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-md font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="px-3 py-1.5 rounded-md font-medium bg-[var(--brand)] text-[var(--brand-foreground)] hover:opacity-90 transition-opacity"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

