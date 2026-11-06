"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

/**
 * Root page — immediately redirects authenticated staff to their landing page.
 * Non-staff are sent to /login.
 */
export default function RootPage() {
  const router = useRouter();
  const { user, loading, isAdmin, isStaff } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user || !isStaff) {
      router.replace("/login");
    } else if (isAdmin) {
      router.replace("/dashboard");
    } else {
      router.replace("/problems");
    }
  }, [loading, user, isAdmin, isStaff, router]);

  // Minimal loading splash while auth resolves
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
      }}
    >
      <div
        style={{
          width: "42px",
          height: "42px",
          borderRadius: "50%",
          border: "3px solid rgba(99, 102, 241, 0.2)",
          borderTopColor: "var(--accent-primary)",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
        Initialising staff portal...
      </div>
    </div>
  );
}
