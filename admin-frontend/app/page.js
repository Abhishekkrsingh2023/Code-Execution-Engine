"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import AdminNavbar from "@/components/AdminNavbar";
import DashboardStats from "@/components/DashboardStats";
import ProblemManager from "@/components/ProblemManager";
import UserManager from "@/components/UserManager";
import AuditLogs from "@/components/AuditLogs";
import TemplatesManager from "@/components/TemplatesManager";
import AccessDenied from "@/components/AccessDenied";
import ConfirmModal from "@/components/ConfirmModal";
import Toast from "@/components/Toast";

export default function StaffPortalPage() {
  const router = useRouter();
  const { user, loading, isAdmin, isModerator, isStaff } = useAuth();

  // Active Tab: Admins start on "stats", Moderators start on "problems"
  const [activeTab, setActiveTab] = useState("problems");

  // Sync default tab once user loads
  useEffect(() => {
    if (user) {
      if (isAdmin) {
        setActiveTab("stats");
      } else {
        setActiveTab("problems");
      }
    }
  }, [user, isAdmin]);

  // Auth gate check
  useEffect(() => {
    if (!loading && (!user || !isStaff)) {
      router.push("/login");
    }
  }, [loading, user, isStaff, router]);

  // Toast System
  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Confirm Dialog Modal
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    type: "warning",
    onConfirm: () => {},
  });

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
    return null; // Will redirect via useEffect
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Sticky Navigation Bar */}
      <AdminNavbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="admin-container" style={{ flex: 1 }}>
        {activeTab === "stats" && (
          isAdmin ? (
            <DashboardStats showToast={showToast} />
          ) : (
            <AccessDenied
              requiredRole="admin"
              onReturn={() => setActiveTab("problems")}
            />
          )
        )}

        {activeTab === "problems" && (
          <ProblemManager
            showToast={showToast}
            setConfirmDialog={setConfirmDialog}
          />
        )}

        {activeTab === "users" && (
          isAdmin ? (
            <UserManager
              showToast={showToast}
              setConfirmDialog={setConfirmDialog}
            />
          ) : (
            <AccessDenied
              requiredRole="admin"
              onReturn={() => setActiveTab("problems")}
            />
          )
        )}

        {activeTab === "audit" && (
          isAdmin ? (
            <AuditLogs showToast={showToast} />
          ) : (
            <AccessDenied
              requiredRole="admin"
              onReturn={() => setActiveTab("problems")}
            />
          )
        )}

        {activeTab === "templates" && (
          <TemplatesManager showToast={showToast} />
        )}
      </main>

      {/* Confirmation Dialog Modal */}
      <ConfirmModal
        dialog={confirmDialog}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />

      {/* Toast Notification Container */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
