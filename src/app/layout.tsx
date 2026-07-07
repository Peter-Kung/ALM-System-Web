import "./globals.css";

import type { Metadata } from "next";
import { ReactNode } from "react";

import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: env.appName,
  description: "Personal net worth dashboard foundation",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
