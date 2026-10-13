import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/api-helpers";

export default function robots(): MetadataRoute.Robots {
  const base = appUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/webmaster", "/account", "/checkout", "/api"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
