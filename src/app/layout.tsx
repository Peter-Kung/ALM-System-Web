import "./globals.css";

import type { Metadata, Viewport } from "next";
import { ReactNode } from "react";

import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: env.appName,
  description: "Private household finance workspace with installable web-app metadata.",
  applicationName: env.appName,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: env.appName,
  },
  icons: {
    apple: "/apple-icon",
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#f4efe5",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
