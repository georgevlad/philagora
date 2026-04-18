import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  RootOgCard,
  createOgImageResponse,
} from "@/lib/seo/og";

export const runtime = "nodejs";
export const alt = "Philagora — Philosophy, interrupted by the news.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return createOgImageResponse(<RootOgCard />);
}
