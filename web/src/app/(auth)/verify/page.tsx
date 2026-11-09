"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useActionState, useState, useEffect, Suspense } from "react";
import { verifyOtpAction, requestOtpAction } from "@/lib/auth/actions";
import { ArrowRight, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";

function VerifyForm() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const next = searchParams.get("next") || "/problems";

  const [state, formAction, isPending] = useActionState(verifyOtpAction, null);
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(initialEmail ? 60 : 0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleResend = async () => {
    if (countdown > 0 || !email || resending) return;
    setResending(true);
    setResendNotice(null);

    const res = await requestOtpAction(email);
    setResending(false);
    if (res.success) {
      setResendNotice(res.message || "A new 6-digit code has been sent.");
      setCountdown(60);
    } else {
      setResendNotice(res.error || "Failed to resend verification code.");
    }
  };

  const handleOtpChange = (val: string) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 6);
    setOtp(cleaned);
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
          Verify your email
        </h1>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Enter the 6-digit verification code sent to your registered email.
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

        {resendNotice && (
          <div className="mb-4 flex items-start gap-2 p-2.5 rounded-md bg-[var(--easy-bg)] border border-[var(--easy-border)] text-[var(--easy)] text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{resendNotice}</span>
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium text-[var(--foreground)] mb-1.5"
            >
              Registered Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alice@example.com"
              className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="otp"
                className="block text-xs font-medium text-[var(--foreground)]"
              >
                6-Digit Passcode
              </label>
              <button
                type="button"
                onClick={handleResend}
                disabled={countdown > 0 || resending || !email}
                className="text-[11px] text-[var(--brand)] hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer inline-flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${resending ? "animate-spin" : ""}`} />
                <span>{countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}</span>
              </button>
            </div>
            <input
              id="otp"
              name="otp"
              type="text"
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(e) => handleOtpChange(e.target.value)}
              placeholder="123456"
              className="w-full h-10 px-3 text-center tracking-[0.3em] font-mono text-base font-semibold rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <button
            type="submit"
            disabled={isPending || otp.length !== 6 || !email}
            className="w-full h-9 rounded-md bg-[var(--brand)] text-[var(--brand-foreground)] text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <span>{isPending ? "Verifying..." : "Verify & Continue"}</span>
            {!isPending && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-[var(--muted-foreground)]">
        Back to{" "}
        <Link href="/login" className="text-[var(--brand)] hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:px-6">
      <Suspense fallback={<div className="w-full max-w-sm h-64 rounded-lg border border-[var(--border)] bg-[var(--card)] animate-pulse" />}>
        <VerifyForm />
      </Suspense>
    </div>
  );
}
