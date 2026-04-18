import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { CSSProperties, ReactElement } from "react";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

export const COLORS = {
  parchment: "#F5EFE2",
  parchmentDark: "#EAE1CE",
  ink: "#2A2520",
  inkLight: "#4A4036",
  inkLighter: "#7A6F60",
  terracotta: "#B34E30",
  burgundy: "#7A2E2E",
  gold: "#A68A3E",
  border: "#D8CBB1",
};

export const OG_SERIF_FONT = '"Playfair Display", Georgia, "Times New Roman", serif';
export const OG_BODY_FONT = '"Lora", Georgia, "Times New Roman", serif';
export const OG_MONO_FONT = '"Philagora Mono", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';

const ROOT_TITLE = "Philagora";
const ROOT_SUBTITLE = "Philosophy, interrupted by the news.";

const CANVAS_STYLE: CSSProperties = {
  position: "relative",
  display: "flex",
  width: "100%",
  height: "100%",
  backgroundColor: COLORS.parchment,
  color: COLORS.ink,
  overflow: "hidden",
};

function loadFontSafe(filename: string): ArrayBuffer | null {
  try {
    const fontPath = path.join(process.cwd(), "public", "fonts", filename);

    if (!fs.existsSync(fontPath)) {
      return null;
    }

    const file = fs.readFileSync(fontPath);
    return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  } catch {
    return null;
  }
}

function loadBundledFallbackFont(): ArrayBuffer | null {
  try {
    const fontPath = path.join(
      process.cwd(),
      "node_modules",
      "next",
      "dist",
      "compiled",
      "@vercel",
      "og",
      "noto-sans-v27-latin-regular.ttf"
    );

    if (!fs.existsSync(fontPath)) {
      return null;
    }

    const file = fs.readFileSync(fontPath);
    return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  } catch {
    return null;
  }
}

export function loadOgFonts() {
  const playfair = loadFontSafe("PlayfairDisplay-Bold.woff");
  const lora = loadFontSafe("Lora-Regular.woff");
  const fallback = loadBundledFallbackFont();
  const fonts: {
    name: string;
    data: ArrayBuffer;
    weight: 400 | 700;
    style: "normal";
  }[] = [];

  if (playfair) {
    fonts.push({
      name: "Playfair Display",
      data: playfair,
      weight: 700,
      style: "normal",
    });
  } else if (fallback) {
    fonts.push({
      name: "Playfair Display",
      data: fallback,
      weight: 700,
      style: "normal",
    });
  }

  if (lora) {
    fonts.push({
      name: "Lora",
      data: lora,
      weight: 400,
      style: "normal",
    });
  } else if (fallback) {
    fonts.push({
      name: "Lora",
      data: fallback,
      weight: 400,
      style: "normal",
    });
  }

  if (fallback) {
    fonts.push({
      name: "Philagora Mono",
      data: fallback,
      weight: 400,
      style: "normal",
    });
  }

  return fonts;
}

export function createOgImageResponse(element: ReactElement) {
  return new ImageResponse(element, {
    ...OG_SIZE,
    fonts: loadOgFonts(),
  });
}

export function truncateOgText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).replace(/\s+\S*$/, "")}…`;
}

export function buildOgExcerpt(
  primary: string | null | undefined,
  fallback: string,
  maxLength: number
): string {
  const source = primary?.trim() ? primary : fallback;
  return truncateOgText(source, maxLength);
}

export function FooterStrip({
  label,
  textColor = COLORS.terracotta,
  hairlineColor = COLORS.gold,
}: {
  label: string;
  textColor?: string;
  hairlineColor?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        borderTop: `1px solid ${hairlineColor}`,
        paddingTop: 20,
        fontFamily: OG_MONO_FONT,
        fontSize: 18,
        letterSpacing: 2,
        color: textColor,
      }}
    >
      {label}
    </div>
  );
}

export function RootOgCard() {
  return (
    <div style={CANVAS_STYLE}>
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 80,
          width: 6,
          height: "60%",
          backgroundColor: COLORS.terracotta,
          borderRadius: 999,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          padding: "100px 140px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: OG_SERIF_FONT,
            fontSize: 120,
            lineHeight: 1,
            color: COLORS.ink,
          }}
        >
          {ROOT_TITLE}
        </div>
        <div
          style={{
            marginTop: 28,
            fontFamily: OG_BODY_FONT,
            fontSize: 36,
            lineHeight: 1.3,
            color: COLORS.inkLight,
          }}
        >
          {ROOT_SUBTITLE}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 64,
          bottom: 48,
          fontFamily: OG_MONO_FONT,
          fontSize: 20,
          color: COLORS.inkLighter,
        }}
      >
        philagora.social
      </div>
    </div>
  );
}

export function createRootOgImageResponse() {
  return createOgImageResponse(<RootOgCard />);
}
