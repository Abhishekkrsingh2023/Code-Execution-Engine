"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Code0Loader from "./Code0Loader";

function isPublicRoute(pathname) {
  if (!pathname) return true;
  const path = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  if (
    path === "/" ||
    path === "/login" ||
    path === "/register" ||
    path === "/verify" ||
    path === "/about" ||
    path === "/abouts" ||
    path === "/leaderboard" ||
    path.startsWith("/problems")
  ) {
    return true;
  }
  return false;
}

export default function AuthGuard({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || !pathname) return;

    const path = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
    const isPublic = isPublicRoute(path);
    const isAuthPage =
      path === "/login" ||
      path === "/register" ||
      (path === "/verify" && user?.is_email_verified);

    // If not authenticated and visiting a protected route -> redirect to /login
    if (!user && !isPublic) {
      router.replace(`/login?redirect=${encodeURIComponent(path)}`);
      return;
    }

    // If authenticated and visiting /login or /register -> redirect to home
    if (user && isAuthPage) {
      router.replace("/");
      return;
    }
  }, [user, loading, pathname, router]);

  const cleanPath = pathname
    ? pathname === "/"
      ? "/"
      : pathname.replace(/\/+$/, "")
    : "/";
  const isPublic = isPublicRoute(cleanPath);

  // Still verifying session from storage or backend
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Code0Loader fullscreen={false} text="Authenticating session..." />
      </div>
    );
  }

  // Not authenticated and trying to access a protected route
  if (!user && !isPublic) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Code0Loader fullscreen={false} text="Redirecting to login..." />
      </div>
    );
  }

  return <>{children}</>;
}
