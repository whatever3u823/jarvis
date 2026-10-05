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
import { headers } from "next/headers";
import { ReaderProvider } from "@/components/reader/ReaderDrawer";
import { SetupScreen } from "@/components/SetupScreen";
import { TopBar } from "@/components/TopBar";
import { UploadProvider } from "@/components/UploadProvider";
import { appPassword, config } from "@/lib/config";
import { getSetupStatus } from "@/lib/setup";

export const metadata: Metadata = {
  title: { default: "Jarvis · Private Library", template: "%s · Jarvis" },
  description: "A private library of books, searchable and answerable from its own pages.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0b0b0a", colorScheme: "dark" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-jarvis-path") ?? "";
  // The sign-in page never needs the library itself.
  const setup = path === "/login" ? null : await getSetupStatus();
  return (
    <html lang="en">
      <body className="min-h-dvh bg-ink text-ivory">
        {setup && !setup.ready ? (
          <SetupScreen status={setup} />
        ) : path === "/login" ? (
          <main>{children}</main>
        ) : (
          <UploadProvider mode={config.storage === "blob" ? "blob" : "multipart"}>
            <ReaderProvider>
              <TopBar canSignOut={Boolean(appPassword())} />
              <main>{children}</main>
            </ReaderProvider>
          </UploadProvider>
        )}
      </body>
    </html>
  );
}
