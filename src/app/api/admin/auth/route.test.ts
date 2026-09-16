import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

function request(body: string) {
  return new NextRequest("http://localhost/api/admin/auth", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.1" },
    body,
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ADMIN_PASSWORD", "review-password");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("admin login", () => {
  it.each(["{", "null", "[]", '{}', '{"password":123}', '{"password":[1,2]}'])(
    "rejects malformed credentials with 400: %s", async (body) => {
      const { POST } = await import("./route");
      expect((await POST(request(body))).status).toBe(400);
    },
  );

  it("limits failed attempts, reports retry time, and expires at the exact window boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-16T12:00:00Z"));
    const { POST } = await import("./route");
    for (let i = 0; i < 5; i++) {
      expect((await POST(request('{"password":"wrong"}'))).status).toBe(401);
    }
    const denied = await POST(request('{"password":"review-password"}'));
    expect(denied.status).toBe(429);
    expect(denied.headers.get("Retry-After")).toBe("900");
    vi.setSystemTime(new Date("2026-09-16T12:15:00Z"));
    const accepted = await POST(request('{"password":"review-password"}'));
    expect(accepted.status).toBe(200);
    expect(accepted.headers.get("set-cookie")).toContain("HttpOnly");
    expect(accepted.headers.get("set-cookie")).toContain("Secure");
  });
});
