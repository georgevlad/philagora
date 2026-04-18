import { getAgoraThreadById, getPhilosophersMap } from "@/lib/data";
import {
  COLORS,
  FooterStrip,
  OG_CONTENT_TYPE,
  OG_BODY_FONT,
  OG_MONO_FONT,
  OG_SERIF_FONT,
  OG_SIZE,
  createOgImageResponse,
  createRootOgImageResponse,
  truncateOgText,
} from "@/lib/seo/og";

export const runtime = "nodejs";
export const alt = "Philagora Agora preview";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

interface Props {
  params: Promise<{ threadId: string }>;
}

export default async function AgoraOpenGraphImage({ params }: Props) {
  const { threadId } = await params;
  const thread = getAgoraThreadById(threadId);

  if (!thread || thread.hiddenFromFeed) {
    return createRootOgImageResponse();
  }

  const philosophersMap = getPhilosophersMap();
  const names = (
    thread.responses.length > 0
      ? thread.responses.map((response) => response.philosopherName)
      : thread.philosophers
          .map((philosopherId) => philosophersMap[philosopherId]?.name)
          .filter((name): name is string => Boolean(name))
  ).filter((name, index, allNames) => allNames.indexOf(name) === index);

  const question = truncateOgText(thread.question, 120);
  const answeredBy =
    names.length > 0 ? `Answered by ${names.join(", ")}` : "Answered by Philagora";

  return createOgImageResponse(
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        padding: "72px 92px 52px",
        backgroundColor: COLORS.parchment,
        color: COLORS.ink,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 64,
          fontFamily: OG_SERIF_FONT,
          fontSize: 200,
          lineHeight: 1,
          color: "rgba(122, 46, 46, 0.3)",
        }}
      >
        “
      </div>

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
            justifyContent: "center",
            alignItems: "center",
            padding: "36px 32px 0",
          }}
        >
          <div
            style={{
              fontFamily: OG_SERIF_FONT,
              fontSize: 52,
              lineHeight: 1.12,
              maxWidth: 920,
            }}
          >
            {question}
          </div>
          <div
            style={{
              marginTop: 30,
              fontFamily: OG_BODY_FONT,
              fontSize: 26,
              lineHeight: 1.3,
              color: COLORS.inkLight,
              maxWidth: 880,
            }}
          >
            {answeredBy}
          </div>
        </div>

        <FooterStrip label="THE AGORA · PHILAGORA" />
      </div>
    </div>
  );
}
