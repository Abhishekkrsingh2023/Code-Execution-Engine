"use client";

/**
 * PageWrapper — shared layout used by every admin page.
 *
 * Handles:
 *  - Auth guard (redirects non-staff to /login)
 *  - Loading spinner while session is initialising
 *  - AdminNavbar (sticky, route-aware)
 *  - Toast notification system
 *  - Confirm-dialog modal
 *
 * Props injected into children via render-prop pattern:
 *   { showToast, setConfirmDialog }
 *
 * Usage:
 *   <PageWrapper requireAdmin>
 *     {({ showToast, setConfirmDialog }) => <MyManager ... />}
 *   </PageWrapper>
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import AdminNavbar from "@/components/AdminNavbar";
import ConfirmModal from "@/components/ConfirmModal";
import Toast from "@/components/Toast";
import AccessDenied from "@/components/AccessDenied";

export default function PageWrapper({ children, requireAdmin = false }) {
  const router = useRouter();
  const { user, loading, isAdmin, isStaff } = useAuth();

  // Toast state
  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Confirm-dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    type: "warning",
    onConfirm: () => {},
  });

  // Redirect non-staff to login
  useEffect(() => {
    if (!loading && (!user || !isStaff)) {
      router.push("/login");
    }
  }, [loading, user, isStaff, router]);

  // Loading state
  if (loading) {
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
          Authenticating staff session...
        </div>
      </div>
    );
  }

  if (!user || !isStaff) {
    return null; // Redirect in progress via useEffect
  }

  // Role gate for admin-only pages
  if (requireAdmin && !isAdmin) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <AdminNavbar />
        <main className="admin-container" style={{ flex: 1 }}>
          <AccessDenied
            requiredRole="admin"
            onReturn={() => router.push("/problems")}
          />
        </main>
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AdminNavbar />

      <main className="admin-container" style={{ flex: 1 }}>
        {typeof children === "function"
          ? children({ showToast, setConfirmDialog })
          : children}
      </main>

      <ConfirmModal
        dialog={confirmDialog}
        onClose={() => setConfirmDialog((d) => ({ ...d, isOpen: false }))}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

