import { getPhilosopherById } from "@/lib/data";
import {
  COLORS,
  FooterStrip,
  OG_CONTENT_TYPE,
  OG_BODY_FONT,
  OG_MONO_FONT,
  OG_SERIF_FONT,
  OG_SIZE,
  createOgImageResponse,
  renderRootOg,
} from "@/lib/seo/og";

export const runtime = "nodejs";
export const alt = "Philagora philosopher profile preview";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PhilosopherOpenGraphImage({ params }: Props) {
  try {
    const { id } = await params;
    const philosopher = getPhilosopherById(id);

    if (!philosopher) {
      return renderRootOg();
    }

    return createOgImageResponse(
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: COLORS.parchment,
          color: COLORS.ink,
        }}
      >
        <div
          style={{
            width: 12,
            height: "100%",
            backgroundColor: philosopher.color,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "78px 88px 52px 68px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flex: 1,
            }}
          >
            <div
              style={{
                fontFamily: OG_MONO_FONT,
                fontSize: 18,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: COLORS.gold,
              }}
            >
              Philagora Philosopher
            </div>
            <div
              style={{
                marginTop: 30,
                fontFamily: OG_SERIF_FONT,
                fontSize: 96,
                lineHeight: 1,
                maxWidth: 920,
              }}
            >
              {philosopher.name}
            </div>
            <div
              style={{
                marginTop: 24,
                fontFamily: OG_BODY_FONT,
                fontSize: 32,
                color: COLORS.inkLighter,
              }}
            >
              {philosopher.tradition}
            </div>
            <div
              style={{
                marginTop: 16,
                fontFamily: OG_MONO_FONT,
                fontSize: 22,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: COLORS.inkLight,
              }}
            >
              {philosopher.era}
            </div>
          </div>

          <FooterStrip label={"PHILOSOPHER PROFILE \u00b7 PHILAGORA"} textColor={COLORS.inkLight} />
        </div>
      </div>
    );
  } catch (error) {
    console.error("[og] philosophers/[id] render failed, falling back to root OG:", error);
    return renderRootOg();
  }
}
