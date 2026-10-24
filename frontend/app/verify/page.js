"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { APP_NAME } from "@/lib/config";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/problems";
  const initialEmail = searchParams.get("email") || "";

  const { verifyOtp, requestOtp } = useAuth();

  const [email, setEmail] = useState(initialEmail);
  const [isEditingEmail, setIsEditingEmail] = useState(!initialEmail);
  const [emailInput, setEmailInput] = useState(initialEmail);

  // 6 individual OTP slot states
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef([]);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [resendNotice, setResendNotice] = useState("");
  const [countdown, setCountdown] = useState(initialEmail ? 60 : 0);
  const [isVerified, setIsVerified] = useState(false);

  // Resend countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  // Focus first input slot on mount if email is set
  useEffect(() => {
    if (email && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [email]);

  // Handle digit change in a specific slot
  const handleDigitChange = (index, value) => {
    // Only accept numeric characters
    const cleanValue = value.replace(/\D/g, "");

    // If pasted or multi-digit input occurred in a slot
    if (cleanValue.length > 1) {
      handlePastedCode(cleanValue);
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = cleanValue;
    setOtpDigits(newDigits);
    setError("");

    // Automatically advance focus to the next slot if digit was entered
    if (cleanValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Keyboard navigation & backspace support
  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        // Current slot is already empty, step back and clear previous
        const newDigits = [...otpDigits];
        newDigits[index - 1] = "";
        setOtpDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        // Clear current slot
        const newDigits = [...otpDigits];
        newDigits[index] = "";
        setOtpDigits(newDigits);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle full clipboard paste of 6-digit code
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    handlePastedCode(pastedData);
  };

  const handlePastedCode = (rawText) => {
    const digits = rawText.replace(/\D/g, "").slice(0, 6).split("");
    if (digits.length === 0) return;

    const newDigits = [...otpDigits];
    digits.forEach((digit, i) => {
      if (i < 6) newDigits[i] = digit;
    });
    setOtpDigits(newDigits);
    setError("");

    // Focus slot after the last pasted digit
    const nextIndex = Math.min(digits.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  // Submit OTP Verification
  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    const fullOtp = otpDigits.join("");

    if (!email || !email.trim()) {
      setError("Please specify a valid email address.");
      setIsEditingEmail(true);
      return;
    }

    if (fullOtp.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await verifyOtp(email.trim(), fullOtp);
      setIsVerified(true);
      setTimeout(() => {
        router.push(redirectPath);
      }, 1600);
    } catch (err) {
      setError(err.message || "Invalid or expired verification code.");
      // Clear inputs to allow re-entry
      setOtpDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Request / Resend OTP
  const handleResend = async () => {
    if (!email || !email.trim() || countdown > 0 || resending) return;

    setError("");
    setResendNotice("");
    setResending(true);

    try {
      const res = await requestOtp(email.trim());
      setResendNotice(
        res?.message || "A new 6-digit verification code has been dispatched to your email."
      );
      setCountdown(60);
      setOtpDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      setTimeout(() => setResendNotice(""), 6000);
    } catch (err) {
      setError(err.message || "Failed to dispatch verification code. Please check your email.");
    } finally {
      setResending(false);
    }
  };

  // Save updated email address
  const handleSaveEmail = (e) => {
    e.preventDefault();
    if (!emailInput || !emailInput.trim() || !emailInput.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setEmail(emailInput.trim());
    setIsEditingEmail(false);
    setError("");
    setCountdown(0); // Allow immediate resend to the new email
  };

  const isOtpComplete = otpDigits.every((d) => d !== "");

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans selection:bg-indigo-600 selection:text-white">
      {/* Background ambient glowing spheres */}
      <div
        className="fixed top-0 right-1/4 w-[550px] h-[500px] bg-indigo-600/[0.12] rounded-full blur-[150px] pointer-events-none -z-10"
        aria-hidden="true"
      />
      <div
        className="fixed bottom-0 left-1/4 w-[500px] h-[450px] bg-purple-600/[0.09] rounded-full blur-[140px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      {/* Top Header & Brand */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors mb-6 group"
        >
          <svg
            className="w-4 h-4 group-hover:-translate-x-1 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Sign In
        </Link>

        {/* Code0 Logo */}
        <div className="flex justify-center mb-3">
          <Link
            href="/"
            className="inline-flex items-center gap-3 group focus:outline-none"
          >
            <Image
              src="/Code0.png"
              alt="Code0 Logo"
              width={72}
              height={40}
              className="h-10 w-auto object-contain transition-transform duration-200 group-hover:scale-105 drop-shadow-[0_0_20px_rgba(99,102,241,0.35)]"
              priority
            />
            <span className="text-2xl font-bold tracking-tight text-white">
              {APP_NAME}
            </span>
          </Link>
        </div>

        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Verify Your Email
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400">
          Enter the 6-digit confirmation code to activate your account
        </p>
      </div>

      {/* Main Verification Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-[#0a0d14] py-8 px-6 sm:px-10 shadow-2xl shadow-black/60 rounded-2xl border border-white/[0.08] relative overflow-hidden backdrop-blur-xl">
          {/* Top glowing neon accent bar */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />

          {isVerified ? (
            /* Success confirmation screen */
            <div className="text-center py-6 space-y-5 animate-in fade-in duration-300">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/50">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Email Verified Successfully!
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Your email is confirmed and your account is now fully active. Redirecting you into Code0...
                </p>
              </div>

              <div className="flex items-center justify-center space-x-2 text-xs text-indigo-400 pt-2">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <span>Entering workspace...</span>
              </div>
            </div>
          ) : (
            /* OTP Entry Form */
            <div className="space-y-6">
              {/* Target Email Badge & Edit Form */}
              <div className="rounded-xl bg-[#07090e]/70 border border-white/[0.06] p-3.5 text-center">
                {isEditingEmail ? (
                  <form onSubmit={handleSaveEmail} className="space-y-2.5">
                    <label
                      htmlFor="targetEmailInput"
                      className="block text-xs font-semibold text-slate-300 text-left"
                    >
                      Target Email Address:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="targetEmailInput"
                        type="email"
                        required
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="your-email@example.com"
                        className="flex-1 px-3 py-1.5 bg-[#0a0d14] border border-white/10 rounded-lg text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                      >
                        Set
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 truncate">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <span className="text-slate-400 truncate">Sent to:</span>
                      <span className="font-mono font-medium text-slate-100 truncate">
                        {email}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailInput(email);
                        setIsEditingEmail(true);
                      }}
                      className="text-indigo-400 hover:text-indigo-300 text-xs font-medium ml-2 underline underline-offset-2 shrink-0 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              {/* Feedback Alerts */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs sm:text-sm flex items-start space-x-2.5">
                  <svg
                    className="w-4 h-4 text-rose-400 shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {resendNotice && (
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs sm:text-sm flex items-start space-x-2.5">
                  <svg
                    className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>{resendNotice}</span>
                </div>
              )}

              {/* 6-Digit Code Input Grid */}
              <form onSubmit={handleVerify} className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      6-Digit Security Code
                    </label>
                    <span className="text-xs text-slate-400">
                      {isOtpComplete ? (
                        <span className="text-emerald-400 font-medium">Ready</span>
                      ) : (
                        "Numbers only"
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between items-center gap-2 sm:gap-3" onPaste={handlePaste}>
                    {otpDigits.map((digit, idx) => {
                      const isFilled = Boolean(digit);
                      return (
                        <input
                          key={idx}
                          ref={(el) => {
                            inputRefs.current[idx] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(idx, e)}
                          className={`w-11 sm:w-13 h-13 sm:h-14 text-center font-mono text-xl sm:text-2xl font-bold rounded-xl transition-all outline-none ${
                            isFilled
                              ? "bg-indigo-950/25 border border-indigo-500/50 text-indigo-100 shadow-[0_0_12px_rgba(99,102,241,0.2)]"
                              : "bg-[#07090e]/90 border border-white/10 text-white hover:border-white/20"
                          } focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 focus:shadow-[0_0_16px_rgba(99,102,241,0.35)]`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Submit Verification Button */}
                <button
                  type="submit"
                  disabled={loading || !isOtpComplete}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <span>Verify & Continue</span>
                  )}
                </button>
              </form>

              {/* Resend OTP & Help Footer */}
              <div className="pt-2 border-t border-white/[0.06] text-center space-y-3">
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <span>Didn&apos;t receive the code?</span>
                  {countdown > 0 ? (
                    <span className="text-slate-500 font-mono">
                      Resend in {countdown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold underline-offset-4 hover:underline transition-colors disabled:opacity-50"
                    >
                      {resending ? "Sending..." : "Resend Code"}
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 leading-normal">
                  Make sure to check your spam or junk folder if you don&apos;t see the email within a minute.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07090e] flex items-center justify-center text-slate-400">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
