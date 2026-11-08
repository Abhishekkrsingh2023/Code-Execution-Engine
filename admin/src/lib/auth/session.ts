import { cookies } from "next/headers";
import type { UserResponse } from "@/types/user";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

interface ParsedCookie {
  name: string;
  value: string;
  maxAge?: number;
  expires?: Date;
  path: string;
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
}

export function parseSetCookieString(setCookieStr: string): ParsedCookie | null {
  const parts = setCookieStr.split(";").map((p) => p.trim());
  if (!parts.length) return null;

  const [nameValue, ...attrs] = parts;
  const equalsIdx = nameValue.indexOf("=");
  if (equalsIdx === -1) return null;

  const name = nameValue.slice(0, equalsIdx).trim();
  const value = nameValue.slice(equalsIdx + 1).trim();

  let maxAge: number | undefined;
  let expires: Date | undefined;
  let path = "/";
  let httpOnly = true;
  let sameSite: "lax" | "strict" | "none" = "lax";
  let secure = process.env.NODE_ENV === "production";

  for (const attr of attrs) {
    const [attrName, attrVal] = attr.split("=").map((a) => a.trim());
    const lowerName = attrName.toLowerCase();
    if (lowerName === "max-age" && attrVal) {
      const parsed = parseInt(attrVal, 10);
      if (!isNaN(parsed)) maxAge = parsed;
    } else if (lowerName === "expires" && attrVal) {
      const parsed = new Date(attrVal);
      if (!isNaN(parsed.getTime())) expires = parsed;
    } else if (lowerName === "path" && attrVal) {
      path = attrVal;
    } else if (lowerName === "httponly") {
      httpOnly = true;
    } else if (lowerName === "samesite" && attrVal) {
      const lowerVal = attrVal.toLowerCase();
      if (lowerVal === "lax" || lowerVal === "strict" || lowerVal === "none") {
        sameSite = lowerVal;
      }
    } else if (lowerName === "secure") {
      secure = process.env.NODE_ENV === "production";
    }
  }

  return {
    name,
    value,
    maxAge,
    expires,
    path,
    httpOnly,
    sameSite,
    secure,
  };
}

export async function setAuthCookiesFromHeaders(setCookieHeaders: string[]): Promise<void> {
  const cookieStore = await cookies();
  for (const header of setCookieHeaders) {
    const parsed = parseSetCookieString(header);
    if (!parsed) continue;

    // Strict host-only: NO domain attribute set
    cookieStore.set(parsed.name, parsed.value, {
      httpOnly: parsed.httpOnly,
      secure: process.env.NODE_ENV === "production",
      sameSite: parsed.sameSite,
      path: parsed.path || "/",
      maxAge: parsed.maxAge,
      expires: parsed.expires,
    });
  }
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");
}

export async function getCurrentUser(): Promise<UserResponse | null> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (!accessToken && !refreshToken) {
      return null;
    }

    const cookieHeader = [
      accessToken ? `access_token=${accessToken}` : "",
      refreshToken ? `refresh_token=${refreshToken}` : "",
    ]
      .filter(Boolean)
      .join("; ");

    const response = await fetch(`${API_BASE_URL}/api-v1/users/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: cookieHeader,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as UserResponse;
  } catch {
    return null;
  }
}

