"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useActionState, useState, Suspense } from "react";
import { registerAction, checkUsernameAvailability } from "@/lib/auth/actions";
import { ArrowRight, AlertCircle, Check, Loader2 } from "lucide-react";

function RegisterForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/problems";

  const [state, formAction, isPending] = useActionState(registerAction, null);
  const [username, setUsername] = useState("");
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  const handleUsernameBlur = async () => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    setUsernameChecking(true);
    try {
      const isAvailable = await checkUsernameAvailability(username);
      setUsernameAvailable(isAvailable);
    } catch {
      setUsernameAvailable(null);
    } finally {
      setUsernameChecking(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-block hover:opacity-90 transition-opacity mb-4">
          <Image
            src="/Code0.png"
            alt="Code0"
            width={72}
            height={36}
            className="h-8 w-auto mx-auto object-contain"
            priority
          />
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
          Create your Code0 account
        </h1>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Join the platform to run, submit, and benchmark your code.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 shadow-xs">
        {state?.error && (
          <div className="mb-4 flex items-start gap-2 p-2.5 rounded-md bg-[var(--hard-bg)] border border-[var(--hard-border)] text-[var(--hard)] text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{state.error}</span>
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />

          <div>
            <label
              htmlFor="name"
              className="block text-xs font-medium text-[var(--foreground)] mb-1.5"
            >
              Full Name <span className="text-[var(--muted-foreground)]">(Optional)</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Alice Smith"
              className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="username"
                className="block text-xs font-medium text-[var(--foreground)]"
              >
                Username
              </label>
              {usernameChecking && (
                <span className="flex items-center gap-1 text-[11px] text-[var(--muted-foreground)]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking...
                </span>
              )}
              {!usernameChecking && usernameAvailable === true && (
                <span className="flex items-center gap-1 text-[11px] text-[var(--easy)]">
                  <Check className="w-3 h-3" />
                  Available
                </span>
              )}
              {!usernameChecking && usernameAvailable === false && (
                <span className="text-[11px] text-[var(--hard)]">Taken or invalid</span>
              )}
            </div>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setUsernameAvailable(null);
              }}
              onBlur={handleUsernameBlur}
              placeholder="alice_dev"
              className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium text-[var(--foreground)] mb-1.5"
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="alice@example.com"
              className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-[var(--foreground)] mb-1.5"
            >
              Password <span className="text-[var(--muted-foreground)]">(min. 6 chars)</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <div>
            <label
              htmlFor="confirm_password"
              className="block text-xs font-medium text-[var(--foreground)] mb-1.5"
            >
              Confirm Password
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full h-9 rounded-md bg-[var(--brand)] text-[var(--brand-foreground)] text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <span>{isPending ? "Creating account..." : "Sign up"}</span>
            {!isPending && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-[var(--muted-foreground)]">
        Already have an account?{" "}
        <Link
          href={`/login${next !== "/problems" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="text-[var(--brand)] hover:underline font-medium"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:px-6">
      <Suspense fallback={<div className="w-full max-w-sm h-64 rounded-lg border border-[var(--border)] bg-[var(--card)] animate-pulse" />}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
