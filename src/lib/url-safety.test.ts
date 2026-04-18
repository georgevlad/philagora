import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("dns/promises", () => ({
  lookup: vi.fn(),
}));

import { lookup } from "dns/promises";
import {
  isIpv4MappedIpv6,
  isPrivateAddress,
  isPublicHostname,
  isSafePublicUrl,
  normalizeIpv4Hostname,
} from "@/lib/url-safety";

const mockLookup = vi.mocked(lookup);

beforeEach(() => {
  mockLookup.mockReset();
});

describe("normalizeIpv4Hostname", () => {
  it("normalizes alternate numeric IPv4 forms to canonical dotted-decimal", () => {
    expect(normalizeIpv4Hostname("2130706433")).toBe("127.0.0.1");
    expect(normalizeIpv4Hostname("0x7f000001")).toBe("127.0.0.1");
    expect(normalizeIpv4Hostname("017700000001")).toBe("127.0.0.1");
    expect(normalizeIpv4Hostname("127.1")).toBe("127.0.0.1");
    expect(normalizeIpv4Hostname("127.0.1")).toBe("127.0.0.1");
    expect(normalizeIpv4Hostname("0177.0.0.1")).toBe("127.0.0.1");
    expect(normalizeIpv4Hostname("127.0.0.1")).toBe("127.0.0.1");
  });

  it("returns null for non-IPv4 hostnames and malformed inputs", () => {
    expect(normalizeIpv4Hostname("example.com")).toBeNull();
    expect(normalizeIpv4Hostname("999.999.999.999")).toBeNull();
    expect(normalizeIpv4Hostname("")).toBeNull();
  });
});

describe("isIpv4MappedIpv6", () => {
  it("extracts mapped IPv4 addresses from supported IPv6 forms", () => {
    expect(isIpv4MappedIpv6("::ffff:127.0.0.1")).toBe("127.0.0.1");
    expect(isIpv4MappedIpv6("::ffff:7f00:1")).toBe("127.0.0.1");
  });

  it("returns null for non-mapped IPv6 addresses", () => {
    expect(isIpv4MappedIpv6("::1")).toBeNull();
    expect(isIpv4MappedIpv6("2606:4700:4700::1111")).toBeNull();
  });
});

describe("isPrivateAddress", () => {
  it("identifies blocked private and local addresses", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("10.5.5.5")).toBe(true);
    expect(isPrivateAddress("192.168.1.1")).toBe(true);
    expect(isPrivateAddress("172.20.0.1")).toBe(true);
    expect(isPrivateAddress("169.254.169.254")).toBe(true);
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("fc00::1")).toBe(true);
    expect(isPrivateAddress("fe80::1")).toBe(true);
    expect(isPrivateAddress("::ffff:7f00:1")).toBe(true);
    expect(isPrivateAddress("::ffff:a00:1")).toBe(true);
  });

  it("does not flag public addresses as private", () => {
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("1.1.1.1")).toBe(false);
    expect(isPrivateAddress("2606:4700:4700::1111")).toBe(false);
    expect(isPrivateAddress("::ffff:8.8.8.8")).toBe(false);
  });
});

describe("isPublicHostname", () => {
  it("rejects localhost and private numeric hosts", async () => {
    await expect(isPublicHostname("localhost")).resolves.toBe(false);
    await expect(isPublicHostname("127.0.0.1")).resolves.toBe(false);
    await expect(isPublicHostname("169.254.169.254")).resolves.toBe(false);
    await expect(isPublicHostname("10.0.0.1")).resolves.toBe(false);
  });

  it("rejects alternate numeric IPv4 hostnames before DNS lookup", async () => {
    await expect(isPublicHostname("2130706433")).resolves.toBe(false);
    await expect(isPublicHostname("0x7f000001")).resolves.toBe(false);
    await expect(isPublicHostname("127.1")).resolves.toBe(false);

    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("returns true only when every resolved address is public", async () => {
    mockLookup.mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }]);
    await expect(isPublicHostname("example.com")).resolves.toBe(true);

    mockLookup.mockResolvedValueOnce([
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ]);
    await expect(isPublicHostname("mixed.example")).resolves.toBe(false);
  });

  it("fails closed on DNS lookup errors", async () => {
    mockLookup.mockRejectedValueOnce(new Error("dns failure"));
    await expect(isPublicHostname("missing.example")).resolves.toBe(false);
  });
});

describe("isSafePublicUrl", () => {
  it("rejects unsafe or malformed URLs", async () => {
    await expect(isSafePublicUrl("http://localhost")).resolves.toBe(false);
    await expect(isSafePublicUrl("http://127.0.0.1/admin")).resolves.toBe(false);
    await expect(isSafePublicUrl("ftp://example.com")).resolves.toBe(false);
    await expect(isSafePublicUrl("javascript:alert(1)")).resolves.toBe(false);
    await expect(isSafePublicUrl("not a url")).resolves.toBe(false);
  });
});
