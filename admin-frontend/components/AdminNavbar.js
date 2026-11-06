"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { APP_NAME } from "@/lib/config";

/**
 * AdminNavbar — sticky top-bar for the admin portal.
 *
 * Uses Next.js App Router `usePathname` to determine the active segment,
 * and `<Link>` for all navigation items (no prop-drilling of setActiveTab).
 */
export default function AdminNavbar() {
  const pathname = usePathname();
  const { user, isAdmin, isModerator, logout } = useAuth();

  const roleName = user?.role || "staff";

  const isActive = (prefix) => pathname.startsWith(prefix);

  return (
    <header className="admin-navbar">
      {/* Brand & Role Identification */}
      <Link href={isAdmin ? "/dashboard" : "/problems"} className="navbar-brand">
        <Image
          src="/Code0.png"
          alt="Code0"
          width={36}
          height={36}
          style={{ objectFit: "contain" }}
          priority
        />
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="brand-title">{APP_NAME}</span>
            <span
              className={`brand-badge ${
                isAdmin ? "badge-admin" : "badge-moderator"
              }`}
            >
              {roleName}
            </span>
          </div>
          <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
            Isolated Operational Console
          </span>
        </div>
      </Link>

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        {isAdmin && (
          <Link
            href="/dashboard"
            className={`nav-tab-btn ${isActive("/dashboard") ? "active" : ""}`}
          >
            <svg
              style={{ width: "16px", height: "16px" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Telemetry &amp; Stats
          </Link>
        )}

        <Link
          href="/problems"
          className={`nav-tab-btn ${isActive("/problems") ? "active" : ""}`}
        >
          <svg
            style={{ width: "16px", height: "16px" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
          Problem Management
        </Link>

        <Link
          href="/contests"
          className={`nav-tab-btn ${isActive("/contests") ? "active" : ""}`}
        >
          <svg
            style={{ width: "16px", height: "16px" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          Contests &amp; Tournaments
        </Link>

        <Link
          href="/templates"
          className={`nav-tab-btn ${isActive("/templates") ? "active" : ""}`}
        >
          <svg
            style={{ width: "16px", height: "16px" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Common Templates
        </Link>

        {isAdmin && (
          <Link
            href="/users"
            className={`nav-tab-btn ${isActive("/users") ? "active" : ""}`}
          >
            <svg
              style={{ width: "16px", height: "16px" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            User Governance
          </Link>
        )}

        {isAdmin && (
          <Link
            href="/audit"
            className={`nav-tab-btn ${isActive("/audit") ? "active" : ""}`}
          >
            <svg
              style={{ width: "16px", height: "16px" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Audit Logs
          </Link>
        )}
      </nav>

      {/* User Section & Logout */}
      <div className="navbar-user-section">
        <div className="user-pill">
          <div
            className="user-avatar-circle"
            style={{
              background: isAdmin
                ? "linear-gradient(135deg, #8b5cf6, #6366f1)"
                : "linear-gradient(135deg, #06b6d4, #0284c7)",
            }}
          >
            {(user?.username || "A")[0].toUpperCase()}
          </div>
          <span className="user-username">{user?.username}</span>
        </div>

        <button
          type="button"
          onClick={logout}
          className="btn btn-secondary btn-sm"
          title="Sign out of Admin Console"
        >
          <svg
            style={{ width: "16px", height: "16px" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Logout
        </button>
      </div>
    </header>
  );
}
