import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/eb-garamond";
import "@fontsource-variable/eb-garamond/wght-italic.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { ReaderProvider } from "@/components/reader/ReaderDrawer";
import { TopBar } from "@/components/TopBar";
import { UploadProvider } from "@/components/UploadProvider";

export const metadata: Metadata = {
  title: { default: "Jarvis · Private Library", template: "%s · Jarvis" },
  description: "A private library of books, searchable and answerable from its own pages.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0b0b0a", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-ink text-ivory">
        <UploadProvider>
          <ReaderProvider>
            <TopBar />
            <main>{children}</main>
          </ReaderProvider>
        </UploadProvider>
      </body>
    </html>
  );
}
