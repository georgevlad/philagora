import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createAdminToken, isAdminOpen, verifyAdminToken, verifyPassword } from "./admin-auth";
import { middleware } from "@/middleware";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ADMIN_PASSWORD", "review-password");
});
afterEach(() => vi.unstubAllEnvs());

describe("admin access policy", () => {
  it("fails closed without a production password in both runtimes", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(isAdminOpen()).toBe(false);
    expect(verifyAdminToken(undefined)).toBe(false);
    const response = await middleware(new NextRequest("http://localhost/api/admin/posts"));
    expect(response.status).toBe(401);
  });

  it("keeps passwordless local development working", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(isAdminOpen()).toBe(true);
    expect(verifyAdminToken(undefined)).toBe(true);
    expect((await middleware(new NextRequest("http://localhost/admin"))).status).toBe(200);
  });

  it("accepts the same token in Node and middleware and rejects it after password rotation", async () => {
    const token = createAdminToken();
    expect(verifyPassword("review-password")).toBe(true);
    expect(verifyPassword("wrong")).toBe(false);
    expect(verifyAdminToken(token)).toBe(true);
    const request = new NextRequest("http://localhost/api/admin/posts", {
      headers: { cookie: `philagora_admin=${token}` },
    });
    expect((await middleware(request)).status).toBe(200);
    vi.stubEnv("ADMIN_PASSWORD", "rotated-password");
    expect(verifyAdminToken(token)).toBe(false);
    expect((await middleware(request)).status).toBe(401);
  });

  it("exempts the auth endpoint but protects similarly named routes", async () => {
    expect((await middleware(new NextRequest("http://localhost/api/admin/auth"))).status).toBe(200);
    expect((await middleware(new NextRequest("http://localhost/api/admin/auth-extra"))).status).toBe(401);
  });
});
