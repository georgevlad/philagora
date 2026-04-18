const DEFAULT_SITE_URL = "https://philagora.social";

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/+$/, "");
}

export function getMetadataBase(): URL {
  return new URL(getSiteUrl());
}

export function toAbsoluteUrl(path: string): string {
  return new URL(path, getMetadataBase()).toString();
}

export function truncateSeoText(value: string, maxLength = 160): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).replace(/\s+\S*$/, "")}…`;
}
