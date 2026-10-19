"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Close menus when route changes (React recommended pattern without cascading render)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
  }

  // Close user dropdown when clicking outside
  useEffect(() => {
    if (!userDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest("#user-dropdown-container")) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [userDropdownOpen]);

  // If on login or register, do not show main navigation
  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  const isModeratorOrAdmin =
    !loading && (user?.role === "admin" || user?.role === "moderator");

  const navLinks = [
    { name: "Problems", href: "/problems" },
    { name: "Leaderboard", href: "/leaderboard" },
    { name: "About", href: "/about" },
  ];

  if (!loading && user) {
    navLinks.push({ name: "Profile", href: "/profile" });
  }

  if (isModeratorOrAdmin) {
    navLinks.push({ name: "Admin", href: "/admin" });
  }

  // Check if current route is within a problem detail page to maximize width
  const isProblemDetail =
    pathname.startsWith("/problems/") && pathname !== "/problems";

  const isLinkActive = (href) => {
    if (href === "/problems") return pathname.startsWith("/problems");
    if (href === "/leaderboard") return pathname.startsWith("/leaderboard");
    if (href === "/about") return pathname === "/about" || pathname === "/abouts";
    if (href === "/profile") return pathname.startsWith("/profile");
    if (href === "/admin") return pathname.startsWith("/admin");
    return pathname === href;
  };

  const userInitial = user?.username
    ? user.username.charAt(0).toUpperCase()
    : "U";

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-[#07090e]/85 border-b border-white/[0.08]">
      <div
        className={`${
          isProblemDetail
            ? "w-full px-4 sm:px-6"
            : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        }`}
      >
        <div className="relative flex items-center justify-between h-16">
          {/* Left: Brand Logo */}
          <div className="flex items-center shrink-0">
            <Link
              href="/"
              className="flex items-center space-x-2.5 text-white font-bold text-lg tracking-tight hover:opacity-95 transition-all group"
            >
              <Image
                src="/Code0.png"
                alt="Code0 Logo"
                width={56}
                height={32}
                className="h-8 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
                priority
              />
            </Link>
          </div>

          {/* Center: Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-8 absolute left-1/2 -translate-x-1/2">
            {navLinks.map((link) => {
              const active = isLinkActive(link.href);

              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`relative py-5 text-sm font-medium transition-colors ${
                    active
                      ? "text-white font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>{link.name}</span>
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.9)]" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right: Status Pill & User Profile */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Online Status Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0d121f] border border-white/10 text-xs text-slate-300 shadow-inner">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
              </span>
              <span className="font-medium text-slate-300">Online</span>
            </div>

            {/* User Profile Avatar / Dropdown */}
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-slate-800 animate-pulse" />
            ) : user ? (
              <div className="relative" id="user-dropdown-container">
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-md shadow-indigo-600/20 hover:ring-2 hover:ring-indigo-400/50 transition-all focus:outline-none"
                  aria-label="User profile menu"
                  aria-expanded={userDropdownOpen}
                >
                  {userInitial}
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-[#0e1322] border border-white/10 rounded-xl shadow-2xl py-1.5 z-50 backdrop-blur-xl">
                    <div className="px-3.5 py-2 border-b border-white/[0.08]">
                      <p className="text-xs font-semibold text-white truncate">
                        {user.username}
                      </p>
                      <p className="text-[11px] text-slate-400 capitalize">
                        {user.role}
                      </p>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setUserDropdownOpen(false)}
                      className="block px-3.5 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors"
                    >
                      Profile & Submissions
                    </Link>
                    <Link
                      href="/leaderboard"
                      onClick={() => setUserDropdownOpen(false)}
                      className="block px-3.5 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors"
                    >
                      Leaderboard
                    </Link>
                    {isModeratorOrAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setUserDropdownOpen(false)}
                        className="block px-3.5 py-2 text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition-colors"
                      >
                        Admin Console
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border-t border-white/[0.06] mt-1 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] focus:outline-none"
              aria-label="Toggle menu"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/10 bg-[#07090e]/95 backdrop-blur-xl px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((link) => {
            const active = isLinkActive(link.href);
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-600/20 text-white font-semibold border-l-2 border-indigo-500"
                    : "text-slate-300 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
          {user ? (
            <div className="pt-2 border-t border-white/[0.08] mt-2 space-y-1">
              <div className="px-3 py-1.5 text-xs text-slate-400">
                Signed in as{" "}
                <span className="font-semibold text-white">
                  {user.username}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="pt-2 flex gap-2 border-t border-white/[0.08] mt-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 text-center py-2 text-xs font-medium text-slate-300 bg-[#0e1322] border border-white/10 rounded-lg hover:text-white transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 text-center py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
