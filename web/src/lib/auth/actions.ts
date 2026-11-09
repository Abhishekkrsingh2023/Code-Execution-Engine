"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api/client";
import { parseSetCookieHeader } from "@/lib/auth/cookies";
import type { MessageResponse, UsernameAvailabilityResponse, OTPResponse } from "@/types/user";

export interface AuthActionResult {
  error?: string;
  success?: boolean;
  unverifiedEmail?: string;
  redirectToVerify?: boolean;
}

export async function loginAction(
  _prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const usernameOrEmail = String(formData.get("username_or_email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/problems").trim();

  if (!usernameOrEmail || !password) {
    return { error: "Please enter your username/email and password." };
  }

  const baseUrl = getApiBaseUrl();
  let response: Response;

  try {
    response = await fetch(`${baseUrl}/api-v1/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username_or_email: usernameOrEmail,
        password,
      }),
    });
  } catch {
    return { error: "Unable to reach the server. Please try again." };
  }

  if (response.status === 403) {
    let detail = "Email address is not verified.";
    try {
      const data = await response.json();
      if (data?.detail) detail = String(data.detail);
    } catch {
      // not json
    }
    return {
      error: detail,
      unverifiedEmail: usernameOrEmail.includes("@") ? usernameOrEmail : undefined,
      redirectToVerify: true,
    };
  }

  if (!response.ok) {
    let errorMsg = "Invalid credentials. Please check your username/email and password.";
    try {
      const data = await response.json();
      if (data?.detail && typeof data.detail === "string") {
        errorMsg = data.detail;
      }
    } catch {
      // not json
    }
    return { error: errorMsg };
  }

  const cookieStore = await cookies();
  const setCookies = response.headers.getSetCookie();
  for (const sc of setCookies) {
    const parsed = parseSetCookieHeader(sc);
    if (parsed) {
      cookieStore.set(parsed.name, parsed.value, {
        httpOnly: parsed.httpOnly,
        secure: parsed.secure,
        sameSite: parsed.sameSite,
        path: parsed.path,
        maxAge: parsed.maxAge,
      });
    }
  }

  redirect(next || "/problems");
}

export async function registerAction(
  _prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const name = String(formData.get("name") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirm_password") || "");
  const next = String(formData.get("next") || "/problems").trim();

  if (!username || !email || !password) {
    return { error: "Username, email, and password are required." };
  }

  if (username.length < 3 || username.length > 50) {
    return { error: "Username must be between 3 and 50 characters." };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { error: "Username may only contain letters, numbers, underscores, and dashes." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const baseUrl = getApiBaseUrl();
  let response: Response;

  try {
    response = await fetch(`${baseUrl}/api-v1/users/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name || undefined,
        username,
        email,
        password,
      }),
    });
  } catch {
    return { error: "Unable to connect to the authentication service." };
  }

  if (!response.ok) {
    let errorMsg = "Registration failed.";
    try {
      const data = await response.json();
      if (typeof data?.detail === "string") {
        errorMsg = data.detail;
      } else if (Array.isArray(data?.detail)) {
        errorMsg = data.detail.map((d: { msg?: string }) => d.msg || "").join(", ");
      }
    } catch {
      // not json
    }
    return { error: errorMsg };
  }

  const verifyUrl = `/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`;
  redirect(verifyUrl);
}

export async function verifyOtpAction(
  _prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const email = String(formData.get("email") || "").trim();
  const otp = String(formData.get("otp") || "").trim();
  const next = String(formData.get("next") || "/problems").trim();

  if (!email) {
    return { error: "Email is required." };
  }

  if (!/^\d{6}$/.test(otp)) {
    return { error: "Please enter a valid 6-digit verification code." };
  }

  const baseUrl = getApiBaseUrl();
  let response: Response;

  try {
    response = await fetch(`${baseUrl}/api-v1/users/otp/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        otp,
      }),
    });
  } catch {
    return { error: "Unable to reach the verification server." };
  }

  if (!response.ok) {
    let errorMsg = "Invalid or expired OTP code.";
    try {
      const data = await response.json();
      if (typeof data?.detail === "string") {
        errorMsg = data.detail;
      }
    } catch {
      // not json
    }
    return { error: errorMsg };
  }

  const cookieStore = await cookies();
  const setCookies = response.headers.getSetCookie();

  if (setCookies.length > 0) {
    for (const sc of setCookies) {
      const parsed = parseSetCookieHeader(sc);
      if (parsed) {
        cookieStore.set(parsed.name, parsed.value, {
          httpOnly: parsed.httpOnly,
          secure: parsed.secure,
          sameSite: parsed.sameSite,
          path: parsed.path,
          maxAge: parsed.maxAge,
        });
      }
    }
    redirect(next || "/problems");
  } else {
    redirect("/login?verified=true");
  }
}

export async function requestOtpAction(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    return { success: false, error: "Please provide an email address." };
  }

  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api-v1/users/otp/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: cleanEmail }),
    });

    if (!res.ok) {
      let errorMsg = "Failed to send verification code.";
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") errorMsg = data.detail;
      } catch {
        // not json
      }
      return { success: false, error: errorMsg };
    }

    const data = (await res.json()) as OTPResponse;
    return { success: true, message: data.message || "A 6-digit code has been sent to your email." };
  } catch {
    return { success: false, error: "Failed to dispatch verification code." };
  }
}

export async function checkUsernameAvailability(username: string): Promise<boolean> {
  const clean = username.trim();
  if (!clean || clean.length < 3) return false;

  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api-v1/users/check-username/${encodeURIComponent(clean)}`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as UsernameAvailabilityResponse;
    return Boolean(data.is_available ?? data.available);
  } catch {
    return false;
  }
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const baseUrl = getApiBaseUrl();
  const cookieHeader = cookieStore.toString();

  try {
    await fetch(`${baseUrl}/api-v1/users/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
    });
  } catch {
    // ignore
  } finally {
    cookieStore.delete("access_token");
    cookieStore.delete("refresh_token");
  }
  redirect("/login");
}
