"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { APP_NAME } from "@/lib/config";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [usernameStatus, setUsernameStatus] = useState(null); // { available: bool, checking: bool }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Debounced username availability check
  useEffect(() => {
    if (!formData.username || formData.username.trim().length < 3) {
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus({ checking: true });
      try {
        const res = await api.get(
          `/api-v1/users/check-username/${encodeURIComponent(
            formData.username.trim()
          )}`
        );
        setUsernameStatus({
          checking: false,
          available: res.is_available ?? res.available,
        });
      } catch {
        setUsernameStatus(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (usernameStatus && !usernameStatus.available && !usernameStatus.checking) {
      setError("Username is already taken or invalid. Please choose another.");
      return;
    }

    setLoading(true);

    try {
      await register(
        formData.username.trim(),
        formData.email.trim(),
        formData.password
      );
      setSuccess(true);
    } catch (err) {
      setError(
        err.message ||
          "Registration failed. Email or username might already be in use."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans selection:bg-indigo-600 selection:text-white">
      {/* Background ambient lighting glows */}
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
          href="/"
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
          Back to Code0
        </Link>

        {/* Updated Code0 Logo */}
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
          Create your account
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400">
          Already a coder on Code0?{" "}
          <Link
            href="/login"
            className="text-indigo-400 hover:text-indigo-300 font-semibold underline-offset-4 hover:underline transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>

      {/* Form Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-[#0e1322]/90 backdrop-blur-2xl py-8 px-6 sm:px-10 shadow-2xl shadow-indigo-950/40 rounded-3xl border border-white/10 relative overflow-hidden">
          {/* Top subtle glowing accent bar */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />

          {success ? (
            <div className="text-center py-4 space-y-5">
              <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/40">
                <svg
                  className="w-7 h-7"
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
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Account Created Successfully!
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Your profile has been created. You can now sign in using your credentials or verify via email OTP.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50"
              >
                Proceed to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              {/* Username Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="username"
                    className="block text-xs font-semibold text-slate-300 uppercase tracking-wider"
                  >
                    Username
                  </label>
                  {usernameStatus && (
                    <span className="text-xs">
                      {usernameStatus.checking ? (
                        <span className="text-slate-400">Checking...</span>
                      ) : usernameStatus.available ? (
                        <span className="text-emerald-400 font-medium">
                          ✓ Available
                        </span>
                      ) : (
                        <span className="text-rose-400 font-medium">
                          ✗ Taken
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, username: val });
                    if (!val || val.trim().length < 3) {
                      setUsernameStatus(null);
                    }
                  }}
                  placeholder="e.g. alex_coder"
                  className="w-full px-4 py-2.5 bg-[#07090e]/80 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm transition-all"
                />
              </div>

              {/* Email Field */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="alex@example.com"
                  className="w-full px-4 py-2.5 bg-[#07090e]/80 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm transition-all"
                />
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
                >
                  Password (min 6 chars)
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-[#07090e]/80 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm transition-all"
                />
              </div>

              {/* Confirm Password Field */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      confirmPassword: e.target.value,
                    })
                  }
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-[#07090e]/80 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <span>Create Account</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
