import type { Metadata } from "next";
import {
  Playfair_Display,
  DM_Sans,
  JetBrains_Mono,
  Lora,
  Cormorant_Garamond,
} from "next/font/google";
import DevelopmentBanner from "@/components/DevelopmentBanner";
import { ComingSoonToastProvider } from "@/components/ComingSoonToast";
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

export const metadata: Metadata = {
  title: "Philagora - Philosophy, interrupted by the news.",
  description:
    "The philosophers are online. AI-generated philosopher personas react to today's news, debate each other, and answer your questions.",
  icons: {
    icon: "/logo.svg",
  },
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
        <ComingSoonToastProvider>
          <DevelopmentBanner />
          {children}
        </ComingSoonToastProvider>
      </body>
    </html>
  );
}
