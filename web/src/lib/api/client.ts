import { cookies } from "next/headers";
import { parseSetCookieHeader } from "@/lib/auth/cookies";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function getApiBaseUrl(): string {
  return process.env.API_BASE_URL || "http://localhost:8000";
}

export async function serverFetch<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && !isRetry && !path.includes("/users/refresh") && !path.includes("/users/login")) {
    const refreshToken = cookieStore.get("refresh_token")?.value;
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${baseUrl}/api-v1/users/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `refresh_token=${refreshToken}`,
          },
        });

        if (refreshRes.ok) {
          const setCookies = refreshRes.headers.getSetCookie();
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
          return serverFetch<T>(path, options, true);
        } else {
          cookieStore.delete("access_token");
          cookieStore.delete("refresh_token");
        }
      } catch {
        // Refresh failed
      }
    }
  }

  if (!response.ok) {
    let errorMsg = `API request failed with status ${response.status}`;
    let respData: unknown;
    try {
      respData = await response.json();
      if (respData && typeof respData === "object") {
        const errObj = respData as { detail?: string | Array<{ msg?: string }>; message?: string };
        if (typeof errObj.detail === "string") {
          errorMsg = errObj.detail;
        } else if (Array.isArray(errObj.detail)) {
          errorMsg = errObj.detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
        } else if (errObj.message) {
          errorMsg = errObj.message;
        }
      }
    } catch {
      // response is not JSON
    }
    throw new ApiError(errorMsg, response.status, respData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

