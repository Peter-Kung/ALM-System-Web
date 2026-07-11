import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: env.appName,
    short_name: "ALM",
    description: "Private household finance workspace for Safari and home-screen use.",
    display: "standalone",
    start_url: "/dashboard",
    background_color: "#f4efe5",
    theme_color: "#f4efe5",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
