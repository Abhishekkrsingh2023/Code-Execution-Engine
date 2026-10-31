"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { APP_NAME } from "@/lib/config";

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithOtp, requestOtp } = useAuth();

  const [authMethod, setAuthMethod] = useState("password"); // "password" | "otp"
  const [formData, setFormData] = useState({
    username_or_email: "",
    password: "",
  });

  // OTP flow state
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(formData.username_or_email, formData.password);
      router.push("/");
    } catch (err) {
      setError(
        err.message ||
          "Invalid staff credentials or insufficient privileges."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const res = await requestOtp(otpEmail);
      setOtpSent(true);
      setSuccessMsg(
        res?.message || "A verification passcode has been dispatched to your email."
      );
      setOtpCountdown(60);
      const timer = setInterval(() => {
        setOtpCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(
        err.message ||
          "Failed to send passcode. Ensure email belongs to an existing staff account."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await loginWithOtp(otpEmail, otpCode);
      router.push("/");
    } catch (err) {
      setError(err.message || "Invalid or expired passcode.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: "100%",
          maxWidth: "460px",
          padding: "2.5rem 2.2rem",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border-medium)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "0.75rem",
              marginBottom: "1rem",
            }}
          >
            <Image
              src="/Code0.png"
              alt="Code0 Logo"
              width={48}
              height={48}
              style={{ objectFit: "contain" }}
              priority
            />
            <span
              style={{
                fontSize: "1.45rem",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#ffffff",
              }}
            >
              {APP_NAME}
            </span>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.3rem 0.8rem",
              borderRadius: "var(--radius-full)",
              background: "rgba(99, 102, 241, 0.12)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "#a5b4fc",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "0.75rem",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#6366f1",
                boxShadow: "0 0 8px #6366f1",
              }}
            />
            Admin & Moderator Portal
          </div>

          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              marginTop: "0.25rem",
            }}
          >
            Secure access for authorized administrators & moderators.
          </p>
        </div>

        {/* Auth Method Switcher (Password vs OTP) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.35rem",
            background: "rgba(11, 14, 22, 0.7)",
            padding: "0.3rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            marginBottom: "1.75rem",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setAuthMethod("password");
              setError("");
            }}
            style={{
              padding: "0.5rem",
              borderRadius: "var(--radius-sm)",
              border: "none",
              fontSize: "0.825rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              background:
                authMethod === "password" ? "var(--accent-primary)" : "transparent",
              color: authMethod === "password" ? "#ffffff" : "var(--text-muted)",
              boxShadow:
                authMethod === "password"
                  ? "0 2px 10px rgba(99, 102, 241, 0.35)"
                  : "none",
            }}
          >
            Password Login
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMethod("otp");
              setError("");
            }}
            style={{
              padding: "0.5rem",
              borderRadius: "var(--radius-sm)",
              border: "none",
              fontSize: "0.825rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              background:
                authMethod === "otp" ? "var(--accent-primary)" : "transparent",
              color: authMethod === "otp" ? "#ffffff" : "var(--text-muted)",
              boxShadow:
                authMethod === "otp"
                  ? "0 2px 10px rgba(99, 102, 241, 0.35)"
                  : "none",
            }}
          >
            OTP Code
          </button>
        </div>

        {/* Error / Success Notifications */}
        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fca5a5",
              borderRadius: "var(--radius-md)",
              padding: "0.75rem 1rem",
              fontSize: "0.85rem",
              marginBottom: "1.25rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
            }}
          >
            <svg
              style={{ width: "18px", height: "18px", flexShrink: 0, marginTop: "2px" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>{error}</div>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "#6ee7b7",
              borderRadius: "var(--radius-md)",
              padding: "0.75rem 1rem",
              fontSize: "0.85rem",
              marginBottom: "1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <svg
              style={{ width: "18px", height: "18px", flexShrink: 0 }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div>{successMsg}</div>
          </div>
        )}

        {/* Method 1: Username/Email + Password */}
        {authMethod === "password" && (
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="username_or_email">
                Username or Staff Email
              </label>
              <input
                id="username_or_email"
                type="text"
                required
                className="form-input"
                style={{ width: "100%" }}
                placeholder="admin or admin@code0.dev"
                value={formData.username_or_email}
                onChange={(e) =>
                  setFormData({ ...formData, username_or_email: e.target.value })
                }
                disabled={loading}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1.75rem" }}>
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                className="form-input"
                style={{ width: "100%" }}
                placeholder="••••••••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.75rem", fontSize: "0.95rem" }}
            >
              {loading ? "Authenticating..." : "Sign In to Control Center"}
            </button>
          </form>
        )}

        {/* Method 2: OTP Flow */}
        {authMethod === "otp" && (
          <div>
            {!otpSent ? (
              <form onSubmit={handleRequestOtp}>
                <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                  <label className="form-label" htmlFor="otp_email">
                    Staff Registered Email
                  </label>
                  <input
                    id="otp_email"
                    type="email"
                    required
                    className="form-input"
                    style={{ width: "100%" }}
                    placeholder="moderator@example.com"
                    value={otpEmail}
                    onChange={(e) => setOtpEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "0.75rem" }}
                >
                  {loading ? "Dispatching Code..." : "Send Verification Code"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp}>
                <div className="form-group">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.45rem",
                    }}
                  >
                    <label className="form-label" htmlFor="otp_code">
                      6-Digit Passcode
                    </label>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      Sent to: {otpEmail}
                    </span>
                  </div>
                  <input
                    id="otp_code"
                    type="text"
                    required
                    maxLength={6}
                    className="form-input"
                    style={{
                      width: "100%",
                      letterSpacing: "0.4em",
                      textAlign: "center",
                      fontSize: "1.25rem",
                      fontWeight: 700,
                    }}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.trim())}
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length < 6}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "0.75rem", marginBottom: "1rem" }}
                >
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </button>

                <div style={{ textAlign: "center" }}>
                  <button
                    type="button"
                    disabled={otpCountdown > 0 || loading}
                    onClick={handleRequestOtp}
                    style={{
                      background: "none",
                      border: "none",
                      color:
                        otpCountdown > 0 ? "var(--text-dim)" : "var(--accent-primary)",
                      fontSize: "0.825rem",
                      cursor: otpCountdown > 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    {otpCountdown > 0
                      ? `Resend available in ${otpCountdown}s`
                      : "Resend Passcode"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Security Notice Footer - Strictly No Registration! */}
        <div
          style={{
            marginTop: "2rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid var(--border-subtle)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--text-dim)",
              lineHeight: 1.5,
            }}
          >
            🔒 This console is monitored and restricted to authorized administrative staff.
            Unauthorized access attempts are logged and reported.
          </p>
        </div>
      </div>
    </div>
  );
}
