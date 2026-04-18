import { getDebateById, getPhilosophersMap } from "@/lib/data";
import {
  COLORS,
  FooterStrip,
  OG_CONTENT_TYPE,
  OG_MONO_FONT,
  OG_SERIF_FONT,
  OG_SIZE,
  createOgImageResponse,
  createRootOgImageResponse,
} from "@/lib/seo/og";

export const runtime = "nodejs";
export const alt = "Philagora debate preview";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DebateOpenGraphImage({ params }: Props) {
  const { id } = await params;
  const debate = getDebateById(id);

  if (!debate) {
    return createRootOgImageResponse();
  }

  const philosophersMap = getPhilosophersMap();
  const names = debate.philosophers
    .map((philosopherId) => philosophersMap[philosopherId]?.name)
    .filter((name): name is string => Boolean(name));

  return createOgImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        padding: "72px 88px 52px",
        backgroundColor: COLORS.parchment,
        color: COLORS.ink,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          justifyContent: "space-between",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: OG_SERIF_FONT,
              fontSize: 64,
              lineHeight: 1.08,
              maxWidth: 940,
            }}
          >
            {debate.title}
          </div>

          {names.length > 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: 42,
                fontFamily: OG_MONO_FONT,
                fontSize: 28,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: COLORS.inkLight,
              }}
            >
              <span>{names[0] ?? "Philagora"}</span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  margin: "0 18px",
                  color: COLORS.terracotta,
                }}
              >
                <span style={{ marginRight: 10 }}>•</span>
                <span style={{ color: COLORS.inkLight }}>vs</span>
                <span style={{ marginLeft: 10 }}>•</span>
              </span>
              <span>{names[1] ?? names[0]}</span>
            </div>
          ) : null}
        </div>

        <FooterStrip label="A PHILAGORA DEBATE" textColor={COLORS.inkLight} />
      </div>
    </div>
  );
}
