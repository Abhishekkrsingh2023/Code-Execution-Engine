"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

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
    const isAuthPage = path === "/login" || path === "/register" || (path === "/verify" && user?.is_email_verified);

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

    // If visiting /admin and not an admin or moderator -> redirect to home
    if (path.startsWith("/admin")) {
      const isAllowed = user?.role === "admin" || user?.role === "moderator";
      if (!isAllowed) {
        router.replace("/");
        return;
      }
    }
  }, [user, loading, pathname, router]);

  const cleanPath = pathname ? (pathname === "/" ? "/" : pathname.replace(/\/+$/, "")) : "/";
  const isPublic = isPublicRoute(cleanPath);
  const isUnauthorized = !loading && !user && !isPublic;
  const isForbiddenAdmin =
    !loading &&
    cleanPath.startsWith("/admin") &&
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
