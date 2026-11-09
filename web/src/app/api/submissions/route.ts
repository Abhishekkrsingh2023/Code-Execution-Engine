import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/api/client";

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") || "";
  if (!cookieHeader.includes("access_token=") && !cookieHeader.includes("refresh_token=")) {
    return NextResponse.json(
      { detail: "Authentication required to view submissions. Please log in." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const skip = searchParams.get("skip") || "0";
  const limit = searchParams.get("limit") || "20";
  const problemId = searchParams.get("problem_id");
  const status = searchParams.get("status");

  const query = new URLSearchParams();
  query.set("skip", skip);
  query.set("limit", limit);
  if (problemId) query.set("problem_id", problemId);
  if (status) query.set("status", status);

  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api-v1/users/me/submissions?${query.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { detail: "Failed to communicate with submission service." },
      { status: 500 }
    );
  }
}

