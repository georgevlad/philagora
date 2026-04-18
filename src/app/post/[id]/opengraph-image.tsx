import { getPhilosopherById, getPostById } from "@/lib/data";
import {
  COLORS,
  FooterStrip,
  OG_CONTENT_TYPE,
  OG_MONO_FONT,
  OG_SERIF_FONT,
  OG_BODY_FONT,
  OG_SIZE,
  buildOgExcerpt,
  createOgImageResponse,
  createRootOgImageResponse,
} from "@/lib/seo/og";

export const runtime = "nodejs";
export const alt = "Philagora post preview";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PostOpenGraphImage({ params }: Props) {
  const { id } = await params;
  const post = getPostById(id);

  if (!post) {
    return createRootOgImageResponse();
  }

  const philosopher = getPhilosopherById(post.philosopherId);

  if (!philosopher) {
    return createRootOgImageResponse();
  }

  const thesis = buildOgExcerpt(post.thesis, post.content, 140);

  return createOgImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        padding: "68px 72px 52px",
        backgroundColor: COLORS.parchment,
        color: COLORS.ink,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            width: "100%",
            gap: 48,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 360,
              paddingRight: 36,
              borderRight: `1px solid ${COLORS.border}`,
            }}
          >
            <div
              style={{
                fontFamily: OG_MONO_FONT,
                fontSize: 16,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: COLORS.terracotta,
              }}
            >
              Philosopher
            </div>
            <div
              style={{
                marginTop: 28,
                fontFamily: OG_SERIF_FONT,
                fontSize: 56,
                lineHeight: 1.05,
              }}
            >
              {philosopher.name}
            </div>
            <div
              style={{
                marginTop: 18,
                fontFamily: OG_BODY_FONT,
                fontSize: 24,
                color: COLORS.inkLighter,
              }}
            >
              {philosopher.tradition}
            </div>
            <div
              style={{
                marginTop: 12,
                fontFamily: OG_MONO_FONT,
                fontSize: 18,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: COLORS.inkLight,
              }}
            >
              {philosopher.era}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "center",
              paddingLeft: 8,
            }}
          >
            <div
              style={{
                fontFamily: OG_MONO_FONT,
                fontSize: 16,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: COLORS.gold,
              }}
            >
              Featured Thesis
            </div>
            <div
              style={{
                marginTop: 28,
                fontFamily: OG_SERIF_FONT,
                fontSize: 48,
                lineHeight: 1.08,
                color: COLORS.ink,
              }}
            >
              {thesis}
            </div>
          </div>
        </div>

        <FooterStrip label={`PHILAGORA · in the voice of ${philosopher.name}`} />
      </div>
    </div>
  );
}
