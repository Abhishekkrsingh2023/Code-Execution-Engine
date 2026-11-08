export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function decodeJwtExp(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return null;
  return payload.exp;
}

export function isTokenExpiringSoon(token: string, thresholdSeconds = 30): boolean {
  const exp = decodeJwtExp(token);
  if (!exp) return true;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return exp - nowInSeconds <= thresholdSeconds;
}

