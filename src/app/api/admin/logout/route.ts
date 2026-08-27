import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/auth/admin-session";

// Plain <form method="post"> target (see the admin layout's logout
// button), so this redirects rather than returning JSON.
export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/admin/login", request.url));
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
