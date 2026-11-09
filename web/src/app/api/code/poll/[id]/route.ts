import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/api/client";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  if (!id) {
    return NextResponse.json({ detail: "Missing submission ID." }, { status: 400 });
  }

  const baseUrl = getApiBaseUrl();
  const cookieHeader = request.headers.get("cookie") || "";

  try {
    const res = await fetch(`${baseUrl}/api-v1/code/submission/poll/${encodeURIComponent(id)}`, {
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      cache: "no-store",
    });

    if (res.status === 404) {
      // Submission may still be queued in Redis before worker begins processing
      return NextResponse.json({ status: "queued", submission_id: id }, { status: 200 });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { detail: "Failed to poll submission status." },
      { status: 500 }
    );
  }
}

