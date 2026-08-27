import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  adminCookieValue,
  adminPasswordConfigured,
  checkAdminPassword,
} from "@/lib/auth/admin-session";

export async function POST(request: Request) {
  if (!adminPasswordConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not set on the server." },
      { status: 500 },
    );
  }

  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (!password || !checkAdminPassword(password)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, adminCookieValue()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return response;
}
