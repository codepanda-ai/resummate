export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { stackServerApp } from "@/stack/server";

/**
 * GET /sentry-debug — forwards to FastAPI /api/sentry-debug with the current
 * Stack session access token (no HTML UI; plain text response).
 */
export async function GET() {
  const user = await stackServerApp.getUser({ or: "redirect" });
  const accessToken = await user.getAccessToken();
  if (!accessToken) {
    return new NextResponse("No access token", { status: 401 });
  }

  const h = await headers();
  const apiBase =
    process.env.NODE_ENV === "development"
      ? "http://127.0.0.1:8000"
      : (() => {
          const host =
            h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
          const proto = h.get("x-forwarded-proto") ?? "https";
          return `${proto}://${host}`;
        })();

  const backendRes = await fetch(`${apiBase}/api/sentry-debug`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const body = `Triggered /api/sentry-debug. Backend: ${backendRes.status} ${backendRes.statusText}.\n`;

  return new NextResponse(body, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
