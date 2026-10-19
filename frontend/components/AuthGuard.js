"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

function isPublicRoute(pathname) {
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/about" ||
    pathname === "/abouts" ||
    pathname === "/leaderboard" ||
    pathname.startsWith("/problems")
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
    if (loading) return;

    const isPublic = isPublicRoute(pathname);
    const isAuthPage = pathname === "/login" || pathname === "/register";

    // If not authenticated and visiting a protected route -> redirect to /login
    if (!user && !isPublic) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    // If authenticated and visiting /login or /register -> redirect to home
    if (user && isAuthPage) {
      router.replace("/");
      return;
    }

    // If visiting /admin and not an admin or moderator -> redirect to home
    if (pathname.startsWith("/admin")) {
      const isAllowed = user?.role === "admin" || user?.role === "moderator";
      if (!isAllowed) {
        router.replace("/");
        return;
      }
    }
  }, [user, loading, pathname, router]);

  const isPublic = isPublicRoute(pathname);
  const isUnauthorized = !loading && !user && !isPublic;
  const isForbiddenAdmin =
    !loading &&
    pathname.startsWith("/admin") &&
    user?.role !== "admin" &&
    user?.role !== "moderator";

  if (isUnauthorized || isForbiddenAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh] text-slate-500 text-xs">
        Redirecting...
      </div>
    );
  }

  return <>{children}</>;
}
