"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useState, Suspense } from "react";
import { loginAction } from "@/lib/auth/actions";
import { ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const next = searchParams.get("next") || "/problems";
  const verified = searchParams.get("verified") === "true";

  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [emailInput, setEmailInput] = useState("");

  useEffect(() => {
    if (state?.redirectToVerify && (state.unverifiedEmail || emailInput)) {
      const email = state.unverifiedEmail || emailInput;
      router.push(`/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
    }
  }, [state, emailInput, next, router]);

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
          Welcome back to Code0
        </h1>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Enter your credentials to access your workspace.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 shadow-xs">
        {verified && (
          <div className="mb-4 flex items-center gap-2 p-2.5 rounded-md bg-[var(--easy-bg)] border border-[var(--easy-border)] text-[var(--easy)] text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Email verified successfully. You can now log in.</span>
          </div>
        )}

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
              htmlFor="username_or_email"
              className="block text-xs font-medium text-[var(--foreground)] mb-1.5"
            >
              Username or Email
            </label>
            <input
              id="username_or_email"
              name="username_or_email"
              type="text"
              required
              autoComplete="username"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="alice or alice@example.com"
              className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-[var(--foreground)]"
              >
                Password
              </label>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full h-9 rounded-md bg-[var(--brand)] text-[var(--brand-foreground)] text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <span>{isPending ? "Signing in..." : "Sign in"}</span>
            {!isPending && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </form>

        {/* Quick OTP redirect link */}
        <div className="mt-4 pt-4 border-t border-[var(--border)] text-center text-xs text-[var(--muted-foreground)]">
          <span>Need to verify your email? </span>
          <Link
            href={`/verify${emailInput.includes("@") ? `?email=${encodeURIComponent(emailInput)}` : ""}`}
            className="text-[var(--brand)] hover:underline font-medium"
          >
            Enter verification code
          </Link>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-[var(--muted-foreground)]">
        Don&apos;t have an account?{" "}
        <Link
          href={`/register${next !== "/problems" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="text-[var(--brand)] hover:underline font-medium"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:px-6">
      <Suspense fallback={<div className="w-full max-w-sm h-64 rounded-lg border border-[var(--border)] bg-[var(--card)] animate-pulse" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
