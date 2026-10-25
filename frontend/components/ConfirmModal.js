"use client";

import React, { useEffect } from "react";

/**
 * ConfirmModal: A premium, dark-themed confirmation & alert pop-up modal.
 *
 * Props:
 * - isOpen (bool): whether the modal is visible
 * - title (string): modal heading
 * - message (string): description/body text
 * - confirmText (string): label for the confirmation button (default: "Confirm")
 * - cancelText (string): label for the cancel button. If null, renders in alert-only mode.
 * - type (string): "danger" | "warning" | "info" (default: "warning")
 * - isAlert (bool): if true, only renders a single dismiss button (no cancel)
 * - onConfirm (fn): callback when user clicks confirm/dismiss
 * - onClose (fn): callback when user closes/cancels
 */
export default function ConfirmModal({
  isOpen,
  title = "Are you sure?",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "warning",
  isAlert = false,
  onConfirm,
  onClose,
}) {
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDanger = type === "danger";
  const isWarning = type === "warning";

  const iconBg = isDanger
    ? "bg-rose-950/70 border-rose-500/40 text-rose-400 shadow-rose-900/30"
    : isWarning
    ? "bg-amber-950/70 border-amber-500/40 text-amber-400 shadow-amber-900/30"
    : "bg-indigo-950/70 border-indigo-500/40 text-indigo-400 shadow-indigo-900/30";

  const confirmBtnClasses = isDanger
    ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-600/30"
    : isWarning
    ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-600/30"
    : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      {/* Background card with gentle glow */}
      <div className="relative w-full max-w-md mx-auto">
        <div
          className={`absolute -inset-1 rounded-3xl blur-xl opacity-30 pointer-events-none ${
            isDanger
              ? "bg-rose-600"
              : isWarning
              ? "bg-amber-600"
              : "bg-indigo-600"
          }`}
          aria-hidden="true"
        />

        <div className="relative bg-[#0a0d14] border border-white/10 rounded-2xl p-6 sm:p-7 shadow-2xl shadow-black/90 text-center space-y-5">
          {/* Top Icon Badge */}
          <div
            className={`mx-auto w-12 h-12 rounded-2xl border flex items-center justify-center shadow-lg ${iconBg}`}
          >
            {isDanger ? (
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            ) : isWarning ? (
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
          </div>

          {/* Heading & Content */}
          <div className="space-y-2">
            <h3
              id="confirm-modal-title"
              className="text-base sm:text-lg font-bold text-white tracking-tight"
            >
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
              {message}
            </p>
          </div>

          {/* Buttons row */}
          <div className="flex items-center justify-center gap-3 pt-2">
            {!isAlert && cancelText && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#0e1322] hover:bg-[#141b2c] border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                {cancelText}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onConfirm?.();
                onClose?.();
              }}
              className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-md transition-all active:scale-98 cursor-pointer ${confirmBtnClasses}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
