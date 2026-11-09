import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/api/client";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const cookieHeader = request.headers.get("cookie") || "";
  if (!cookieHeader.includes("access_token=") && !cookieHeader.includes("refresh_token=")) {
    return NextResponse.json(
      { detail: "Authentication required to submit code. Please log in." },
      { status: 401 }
    );
  }

  const baseUrl = getApiBaseUrl();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request payload." }, { status: 400 });
  }

  try {
    const res = await fetch(`${baseUrl}/api-v1/contests/${encodeURIComponent(id)}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { detail: "Failed to communicate with contest evaluation engine." },
      { status: 500 }
    );
  }
}

