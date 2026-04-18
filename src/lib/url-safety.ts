import { lookup } from "dns/promises";
import { isIP } from "net";

const IPV4_OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const STANDARD_DOTTED_IPV4_REGEX =
  /^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/;
const DECIMAL_NUMBER_REGEX = /^(?:0|[1-9]\d*)$/;
const HEX_NUMBER_REGEX = /^0x[0-9a-f]+$/i;
const OCTAL_NUMBER_REGEX = /^0[0-7]+$/;
const HEX_HEXTET_REGEX = /^[0-9a-f]{1,4}$/;
const BIGINT_8 = BigInt(8);
const BIGINT_16 = BigInt(16);
const BIGINT_24 = BigInt(24);
const BIGINT_255 = BigInt(255);
const MAX_IPV4_VALUE = BigInt("0xffffffff");
const MAX_IPV4_PART_TWO = BigInt("0xffffff");
const MAX_IPV4_PART_THREE = BigInt("0xffff");

export const PRIVATE_IPV4_REGEXES: RegExp[] = [
  new RegExp(`^127\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}$`),
  new RegExp(`^10\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}$`),
  new RegExp(`^192\\.168\\.${IPV4_OCTET}\\.${IPV4_OCTET}$`),
  new RegExp(`^172\\.(?:1[6-9]|2\\d|3[0-1])\\.${IPV4_OCTET}\\.${IPV4_OCTET}$`),
  new RegExp(`^169\\.254\\.${IPV4_OCTET}\\.${IPV4_OCTET}$`),
  new RegExp(`^100\\.(?:6[4-9]|[78]\\d|9\\d|1[01]\\d|12[0-7])\\.${IPV4_OCTET}\\.${IPV4_OCTET}$`),
  new RegExp(`^0\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}$`),
  new RegExp(`^(?:22[4-9]|23\\d)\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}$`),
  /^255\.255\.255\.255$/,
];

export const PRIVATE_IPV6_PREFIXES = ["::1", "fc", "fd", "fe80", "fec", "ff", "::ffff:"];

function unwrapIpLiteral(value: string): string {
  if (value.startsWith("[") && value.endsWith("]")) {
    return value.slice(1, -1);
  }

  return value;
}

function parseIpv4Part(part: string): bigint | null {
  if (!part) {
    return null;
  }

  if (HEX_NUMBER_REGEX.test(part)) {
    return BigInt(part);
  }

  if (part.length > 1 && part.startsWith("0")) {
    if (!OCTAL_NUMBER_REGEX.test(part)) {
      return null;
    }

    return BigInt(`0o${part.slice(1)}`);
  }

  if (!DECIMAL_NUMBER_REGEX.test(part)) {
    return null;
  }

  return BigInt(part);
}

function formatIpv4(value: bigint): string {
  return [
    Number((value >> BIGINT_24) & BIGINT_255),
    Number((value >> BIGINT_16) & BIGINT_255),
    Number((value >> BIGINT_8) & BIGINT_255),
    Number(value & BIGINT_255),
  ].join(".");
}

function isStandardDottedIpv4(hostname: string): boolean {
  if (!STANDARD_DOTTED_IPV4_REGEX.test(hostname)) {
    return false;
  }

  return hostname.split(".").every((part) => Number(part) <= 255);
}

export function normalizeIpv4Hostname(hostname: string): string | null {
  const normalized = unwrapIpLiteral(hostname.trim().toLowerCase());

  if (!normalized) {
    return null;
  }

  if (isStandardDottedIpv4(normalized)) {
    return normalized;
  }

  const parts = normalized.split(".");
  if (parts.length === 0 || parts.length > 4) {
    return null;
  }

  const parsedParts = parts.map(parseIpv4Part);
  if (parsedParts.some((part) => part === null)) {
    return null;
  }

  const values = parsedParts as bigint[];

  switch (values.length) {
    case 1: {
      const [value] = values;
      if (value > MAX_IPV4_VALUE) {
        return null;
      }

      return formatIpv4(value);
    }
    case 2: {
      const [a, b] = values;
      if (a > BIGINT_255 || b > MAX_IPV4_PART_TWO) {
        return null;
      }

      return formatIpv4((a << BIGINT_24) | b);
    }
    case 3: {
      const [a, b, c] = values;
      if (a > BIGINT_255 || b > BIGINT_255 || c > MAX_IPV4_PART_THREE) {
        return null;
      }

      return formatIpv4((a << BIGINT_24) | (b << BIGINT_16) | c);
    }
    case 4: {
      if (values.some((value) => value > BIGINT_255)) {
        return null;
      }

      return values.map((value) => value.toString()).join(".");
    }
    default:
      return null;
  }
}

export function isIpv4MappedIpv6(addr: string): string | null {
  const normalized = unwrapIpLiteral(addr.trim().toLowerCase());

  if (!normalized.startsWith("::ffff:")) {
    return null;
  }

  const mappedValue = normalized.slice("::ffff:".length);
  const normalizedIpv4 = normalizeIpv4Hostname(mappedValue);
  if (normalizedIpv4) {
    return normalizedIpv4;
  }

  const hexParts = mappedValue.split(":");
  if (
    hexParts.length !== 2 ||
    !hexParts.every((part) => HEX_HEXTET_REGEX.test(part))
  ) {
    return null;
  }

  const [upper, lower] = hexParts;
  return formatIpv4((BigInt(`0x${upper}`) << BIGINT_16) | BigInt(`0x${lower}`));
}

export function isPrivateAddress(addr: string): boolean {
  const normalized = unwrapIpLiteral(addr.trim().toLowerCase());

  if (normalized.includes(":")) {
    const mappedIpv4 = isIpv4MappedIpv6(normalized);
    if (mappedIpv4) {
      return isPrivateAddress(mappedIpv4);
    }
  }

  const version = isIP(normalized);

  if (version === 4) {
    return PRIVATE_IPV4_REGEXES.some((regex) => regex.test(normalized));
  }

  if (version !== 6) {
    return false;
  }

  if (normalized === "::1") {
    return true;
  }

  if (normalized.startsWith("::ffff:")) {
    const mappedIpv4 = normalized.slice("::ffff:".length);
    return isIP(mappedIpv4) === 4 && isPrivateAddress(mappedIpv4);
  }

  return PRIVATE_IPV6_PREFIXES.some(
    (prefix) => prefix !== "::1" && prefix !== "::ffff:" && normalized.startsWith(prefix)
  );
}

export async function isPublicHostname(hostname: string): Promise<boolean> {
  const normalized = unwrapIpLiteral(hostname.trim().toLowerCase());

  if (!normalized) {
    return false;
  }

  const normalizedIpv4 = normalizeIpv4Hostname(normalized);
  if (normalizedIpv4) {
    return !isPrivateAddress(normalizedIpv4);
  }

  if (["localhost", "ip6-localhost", "ip6-loopback"].includes(normalized)) {
    return false;
  }

  if (isIP(normalized)) {
    return !isPrivateAddress(normalized);
  }

  try {
    const addresses = await lookup(normalized, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every(({ address }) => !isPrivateAddress(address));
  } catch {
    return false;
  }
}

export async function isSafePublicUrl(url: string): Promise<boolean> {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return false;
    }

    return isPublicHostname(parsedUrl.hostname);
  } catch {
    return false;
  }
}
