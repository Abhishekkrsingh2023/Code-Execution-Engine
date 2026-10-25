"use client";

import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

export default function AccessDenied({
  requiredRole = "admin",
  title,
  message,
}) {
  const { user, logout } = useAuth();
  const currentRole = user?.role || "unauthorized";

  const defaultTitle =
    requiredRole === "admin"
      ? "Administrator Access Required"
      : "Moderator Access Required";

  const defaultMessage =
    requiredRole === "admin"
      ? "This console is strictly restricted to platform administrators. Your account does not have administrative privileges."
      : "This workspace is reserved for problem curators and moderators. Your account does not have moderation privileges.";

  return (
    <div className="flex-1 flex items-center justify-center min-h-[75vh] px-4 py-12">
      <div className="relative w-full max-w-xl mx-auto">
        {/* Soft background glow */}
        <div
          className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-rose-600/20 via-amber-600/20 to-indigo-600/20 blur-2xl opacity-50 pointer-events-none"
          aria-hidden="true"
        />

        {/* Access Denied Card */}
        <div className="relative bg-[#0a0d14]/95 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 backdrop-blur-xl text-center space-y-6">
          {/* Shield Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-500/30 flex items-center justify-center shadow-lg shadow-rose-900/30 text-rose-400">
            <svg
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.002A11.959 11.959 0 0112 3.464zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          {/* Heading & Status code */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-mono font-bold tracking-wider uppercase">
              <span>HTTP 403 Forbidden</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {title || defaultTitle}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              {message || defaultMessage}
            </p>
          </div>

          {/* Role Comparison Pill Grid */}
          <div className="bg-[#0e1322] border border-white/[0.08] rounded-xl p-4 text-left grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Current Identity
              </span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-white truncate">
                  {user?.username || "Guest / Anonymous"}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                  {currentRole}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Required Authorization
              </span>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-950 text-indigo-300 border border-indigo-700/60">
                  {requiredRole}
                </span>
                {requiredRole === "moderator" && (
                  <span className="text-[10px] text-slate-400">or admin</span>
                )}
              </div>
            </div>
          </div>

          {/* Security Assurance Box */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5 text-left text-[11px] text-slate-400 leading-relaxed flex items-start gap-2.5">
            <span className="text-indigo-400 mt-0.5 shrink-0">🔒</span>
            <p>
              Strict server-side validation is enforced for all administrative and moderation endpoints. Privilege escalation attempts and unauthorized route access are monitored and logged.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {user?.role === "moderator" && requiredRole === "admin" && (
              <Link
                href="/moderator"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-600/30 transition-all active:scale-98"
              >
                Go to Moderator Studio
              </Link>
            )}

            {user?.role === "admin" && requiredRole === "moderator" && (
              <Link
                href="/admin"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/30"
              >
                Open Admin Console
              </Link>
            )}

            <Link
              href="/problems"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0e1322] hover:bg-[#131a30] text-slate-200 border border-white/10 transition-colors"
            >
              Browse Problems
            </Link>

            <Link
              href="/"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-transparent hover:bg-white/[0.05] text-slate-400 hover:text-white transition-colors"
            >
              Back to Home
            </Link>

            {user && (
              <button
                type="button"
                onClick={logout}
                className="px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors"
              >
                Switch Account
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
