import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteShell } from "../components/site-shell";
import "./globals.css";
import "./editorial.css";

export const metadata: Metadata = {
  title: {
    default: "CivicLens",
    template: "%s | CivicLens",
  },
  description: "Mobile-first civic literacy lessons, claim checks, bills, and district lookup for students.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/civiclens.svg",
    apple: "/icons/civiclens.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#00A98F",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
