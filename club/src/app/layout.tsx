import type { Metadata, Viewport } from "next";
import "@fontsource-variable/eb-garamond";
import "@fontsource-variable/eb-garamond/wght-italic.css";
import "@fontsource/im-fell-english/400.css";
import "@fontsource/im-fell-english/400-italic.css";
import "@fontsource/im-fell-english-sc/400.css";
import "@fontsource-variable/instrument-sans";
import "@fontsource/special-elite/400.css";
import "@fontsource/reenie-beanie/400.css";
import "@fontsource/la-belle-aurore/400.css";
import "@fontsource-variable/noto-serif-armenian";
import "./globals.css";
import { club } from "@/club.config";
import { getLamp } from "@/lib/session";

export const metadata: Metadata = {
  title: { default: club.shortName, template: `%s · ${club.shortName}` },
  description: "A private reading room for two.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [{ color: "#1c140e" }],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lamp = await getLamp();
  return (
    <html lang="en" data-lamp={lamp}>
      <body>{children}</body>
    </html>
  );
}
