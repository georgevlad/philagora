import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  ADMIN_COOKIE_NAME: "philagora_admin",
  verifyAdminToken: vi.fn(),
}));

import {
  getIdentityFromRequest,
  isAdmin,
  isAuthenticated,
  requireAdmin,
} from "@/lib/auth";
import { verifyAdminToken } from "@/lib/admin-auth";

const mockVerifyAdminToken = vi.mocked(verifyAdminToken);

function makeRequest(cookies: Record<string, string> = {}) {
  return {
    cookies: {
      get(name: string) {
        const value = cookies[name];
        return value !== undefined ? { value } : undefined;
      },
    },
  };
}

beforeEach(() => {
  mockVerifyAdminToken.mockReset();
});

describe("getIdentityFromRequest", () => {
  it("returns admin identity when admin token is valid", () => {
    mockVerifyAdminToken.mockReturnValue(true);
    const req = makeRequest({ philagora_admin: "valid-token" });

    const identity = getIdentityFromRequest(req as never);
    expect(identity).toEqual({ type: "admin" });
    expect(mockVerifyAdminToken).toHaveBeenCalledWith("valid-token");
  });

  it("returns anonymous when admin token is invalid", () => {
    mockVerifyAdminToken.mockReturnValue(false);
    const req = makeRequest({ philagora_admin: "bad-token" });

    const identity = getIdentityFromRequest(req as never);
    expect(identity).toEqual({ type: "anonymous" });
  });

  it("returns anonymous when no cookies are present", () => {
    mockVerifyAdminToken.mockReturnValue(false);
    const req = makeRequest({});

    const identity = getIdentityFromRequest(req as never);
    expect(identity).toEqual({ type: "anonymous" });
  });

  it("returns admin when admin is open (verifyAdminToken returns true for undefined)", () => {
    mockVerifyAdminToken.mockReturnValue(true);
    const req = makeRequest({});

    const identity = getIdentityFromRequest(req as never);
    expect(identity).toEqual({ type: "admin" });
  });
});

describe("requireAdmin", () => {
  it("returns null (pass) when request is from admin", () => {
    mockVerifyAdminToken.mockReturnValue(true);
    const req = makeRequest({ philagora_admin: "valid-token" });

    const result = requireAdmin(req as never);
    expect(result).toBeNull();
  });

  it("returns 401 NextResponse when request is anonymous", async () => {
    mockVerifyAdminToken.mockReturnValue(false);
    const req = makeRequest({});

    const result = requireAdmin(req as never);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    await expect(result!.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 401 NextResponse when token is invalid", async () => {
    mockVerifyAdminToken.mockReturnValue(false);
    const req = makeRequest({ philagora_admin: "expired-token" });

    const result = requireAdmin(req as never);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    await expect(result!.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});

describe("identity predicates", () => {
  it("isAdmin returns true for admin identity", () => {
    expect(isAdmin({ type: "admin" })).toBe(true);
  });

  it("isAdmin returns false for anonymous identity", () => {
    expect(isAdmin({ type: "anonymous" })).toBe(false);
  });

  it("isAdmin returns false for user identity", () => {
    expect(isAdmin({ type: "user", id: "123", email: "a@b.com" })).toBe(false);
  });

  it("isAuthenticated returns true for admin", () => {
    expect(isAuthenticated({ type: "admin" })).toBe(true);
  });

  it("isAuthenticated returns true for user", () => {
    expect(isAuthenticated({ type: "user", id: "123", email: "a@b.com" })).toBe(true);
  });

  it("isAuthenticated returns false for anonymous", () => {
    expect(isAuthenticated({ type: "anonymous" })).toBe(false);
  });
});
