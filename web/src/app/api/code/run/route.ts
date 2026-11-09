import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/api/client";

export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") || "";
  if (!cookieHeader.includes("access_token=") && !cookieHeader.includes("refresh_token=")) {
    return NextResponse.json(
      { detail: "Authentication required to run code. Please log in." },
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
    const res = await fetch(`${baseUrl}/api-v1/code/run`, {
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
      { detail: "Failed to communicate with code execution engine." },
      { status: 500 }
    );
  }
}

