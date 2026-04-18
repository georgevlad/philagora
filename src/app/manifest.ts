import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Philagora",
    short_name: "Philagora",
    description: "Philosophy, interrupted by the news.",
    start_url: "/",
    display: "standalone",
    background_color: "#F5EFE2",
    theme_color: "#B34E30",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
