import { NextRequest, NextResponse } from "next/server";
import {
  verifyPassword,
  createAdminToken,
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_MAX_AGE,
} from "@/lib/admin-auth";

// ── Brute-force protection (in-memory, single instance) ──────────
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const failedAttempts = new Map<
  string,
  { count: number; resetAt: number }
>();

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** POST /api/admin/auth — login */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // Clean expired entries for this IP
    const entry = failedAttempts.get(ip);
    if (entry && Date.now() > entry.resetAt) {
      failedAttempts.delete(ip);
    }

    // Check if IP is rate-limited
    const current = failedAttempts.get(ip);
    if (current && current.count >= LOGIN_MAX_ATTEMPTS) {
      const minutesLeft = Math.ceil(
        (current.resetAt - Date.now()) / 60_000
      );
      return NextResponse.json(
        {
          error: `Too many login attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
        },
        { status: 429 }
      );
    }

    const { password } = (await req.json()) as { password?: string };

    if (!password || !verifyPassword(password)) {
      // Track failed attempt
      const existing = failedAttempts.get(ip);
      if (existing) {
        existing.count++;
      } else {
        failedAttempts.set(ip, {
          count: 1,
          resetAt: Date.now() + LOGIN_WINDOW_MS,
        });
      }

      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    // Success — clear failed attempts
    failedAttempts.delete(ip);

    const token = createAdminToken();
    const res = NextResponse.json({ ok: true });

    res.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_COOKIE_MAX_AGE,
    });

    return res;
  } catch {
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}

/** DELETE /api/admin/auth — logout */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
