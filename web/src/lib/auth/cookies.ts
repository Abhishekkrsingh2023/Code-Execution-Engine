export function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const parsed = JSON.parse(jsonPayload) as { exp?: number };
    return typeof parsed.exp === "number" ? parsed.exp : null;
  } catch {
    return null;
  }
}

export function isTokenExpiringSoon(token: string, thresholdSeconds = 30): boolean {
  const exp = decodeJwtExp(token);
  if (!exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return exp - now <= thresholdSeconds;
}

export interface CookieOptions {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge?: number;
}

export function parseSetCookieHeader(setCookieHeader: string): CookieOptions | null {
  const parts = setCookieHeader.split(";").map((p) => p.trim());
  if (parts.length === 0 || !parts[0]) return null;

  const [nameValue, ...attributes] = parts;
  const eqIdx = nameValue.indexOf("=");
  if (eqIdx === -1) return null;

  const name = nameValue.slice(0, eqIdx).trim();
  const value = nameValue.slice(eqIdx + 1).trim();

  let maxAge: number | undefined;
  let path = "/";
  let sameSite: "lax" | "strict" | "none" = "lax";

  for (const attr of attributes) {
    const [attrName, attrVal] = attr.split("=").map((a) => a.trim());
    const lower = attrName.toLowerCase();
    if (lower === "max-age" && attrVal) {
      const parsed = parseInt(attrVal, 10);
      if (!isNaN(parsed)) maxAge = parsed;
    } else if (lower === "path" && attrVal) {
      path = attrVal;
    } else if (lower === "samesite" && attrVal) {
      const sLower = attrVal.toLowerCase();
      if (sLower === "strict" || sLower === "none" || sLower === "lax") {
        sameSite = sLower;
      }
    }
  }

  const isProd = process.env.NODE_ENV === "production";

  return {
    name,
    value,
    httpOnly: true,
    secure: isProd,
    sameSite,
    path,
    maxAge: maxAge ?? (name === "refresh_token" ? 7 * 86400 : 15 * 60),
  };
}

