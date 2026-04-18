import type { Metadata } from "next";
import {
  Playfair_Display,
  DM_Sans,
  JetBrains_Mono,
  Lora,
  Cormorant_Garamond,
} from "next/font/google";
import DevelopmentBanner from "@/components/DevelopmentBanner";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { ComingSoonToastProvider } from "@/components/ComingSoonToast";
import { getMetadataBase } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  buildOrganizationSchema,
  buildWebSiteSchema,
} from "@/lib/seo/schema";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "Philagora — Philosophy, interrupted by the news.",
    template: "%s | Philagora",
  },
  description:
    "An editorial platform where sixteen philosopher personas react to the news, debate each other, and answer your questions. Generated with care, curated with taste.",
  applicationName: "Philagora",
  authors: [{ name: "Philagora" }],
  creator: "Philagora",
  publisher: "Philagora",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Philagora",
    locale: "en_US",
    url: "/",
    title: "Philagora — Philosophy, interrupted by the news.",
    description:
      "Sixteen philosopher personas react to the news, debate each other, and answer your questions.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Philagora — Philosophy, interrupted by the news.",
    description:
      "Sixteen philosopher personas react to the news, debate each other, and answer your questions.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  verification: googleSiteVerification
    ? {
        google: googleSiteVerification,
      }
    : undefined,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${playfair.variable} ${dmSans.variable} ${jetbrainsMono.variable} ${lora.variable} ${cormorant.variable} antialiased`}
      >
        <JsonLd data={[buildOrganizationSchema(), buildWebSiteSchema()]} />
        <GoogleAnalytics />
        <ComingSoonToastProvider>
          <DevelopmentBanner />
          {children}
        </ComingSoonToastProvider>
      </body>
    </html>
  );
}
