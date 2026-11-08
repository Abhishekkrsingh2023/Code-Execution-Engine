import { cookies } from "next/headers";
import { setAuthCookiesFromHeaders, clearAuthCookies } from "../auth/session";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

export class ApiClientError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | null | undefined>;
  skipAuthRefresh?: boolean;
}

export async function serverFetch<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, params, headers = {}, skipAuthRefresh = false, ...rest } = options;

  let url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  const refreshToken = cookieStore.get("refresh_token")?.value;

  const cookieParts: string[] = [];
  if (accessToken) cookieParts.push(`access_token=${accessToken}`);
  if (refreshToken) cookieParts.push(`refresh_token=${refreshToken}`);

  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");

  if (cookieParts.length > 0 && !requestHeaders.has("Cookie")) {
    requestHeaders.set("Cookie", cookieParts.join("; "));
  }

  let requestBody: string | undefined;
  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: requestHeaders,
      body: requestBody,
      cache: "no-store",
    });
  } catch (error) {
    throw new ApiClientError(500, `Failed to reach backend at ${API_BASE_URL}`, error);
  }

  // Automatic token refresh on 401 (single retry)
  if (response.status === 401 && !skipAuthRefresh && refreshToken) {
    try {
      const refreshResponse = await fetch(`${API_BASE_URL}/api-v1/users/refresh`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Cookie: `refresh_token=${refreshToken}`,
        },
        cache: "no-store",
      });

      if (refreshResponse.ok) {
        const setCookies =
          typeof refreshResponse.headers.getSetCookie === "function"
            ? refreshResponse.headers.getSetCookie()
            : [refreshResponse.headers.get("set-cookie") || ""].filter(Boolean);

        if (setCookies.length > 0) {
          await setAuthCookiesFromHeaders(setCookies);
        }

        // Retry the original request once
        return await serverFetch<T>(endpoint, {
          ...options,
          skipAuthRefresh: true,
        });
      } else {
        await clearAuthCookies();
      }
    } catch {
      await clearAuthCookies();
    }
  }

  if (!response.ok) {
    let errorDetail = response.statusText;
    let errorData: unknown = null;
    try {
      errorData = await response.json();
      if (typeof errorData === "object" && errorData !== null && "detail" in errorData) {
        const detail = (errorData as { detail: unknown }).detail;
        if (typeof detail === "string") {
          errorDetail = detail;
        } else if (Array.isArray(detail)) {
          errorDetail = detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(", ");
        }
      }
    } catch {
      // Body not JSON
    }
    throw new ApiClientError(response.status, errorDetail, errorData);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

