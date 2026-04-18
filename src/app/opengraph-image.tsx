import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  renderRootOg,
} from "@/lib/seo/og";

export const runtime = "nodejs";
export const alt = "Philagora \u2014 Philosophy, interrupted by the news.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OpenGraphImage() {
  return renderRootOg();
}
