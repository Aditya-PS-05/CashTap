import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("bch_access_token")?.value;
  const email = cookieStore.get("bch_email")?.value;

  if (!accessToken || !email) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const role = cookieStore.get("bch_role")?.value || null;
  return NextResponse.json({ authenticated: true, accessToken, email, role });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { accessToken, refreshToken, email, role } = body;

  const cookieStore = await cookies();
  cookieStore.set("bch_access_token", accessToken, COOKIE_OPTS);
  cookieStore.set("bch_refresh_token", refreshToken, COOKIE_OPTS);
  if (email) {
    cookieStore.set("bch_email", email, COOKIE_OPTS);
  }
  if (role) {
    cookieStore.set("bch_role", role, COOKIE_OPTS);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("bch_access_token");
  cookieStore.delete("bch_refresh_token");
  cookieStore.delete("bch_email");
  cookieStore.delete("bch_role");
  // Also clean up old cookie names
  cookieStore.delete("bch_address");

  return NextResponse.json({ success: true });
}
