import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/api/server";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/kabinet",
        "/api",
        "/kirish",
        "/faollashtirish",
        "/parolni-tiklash",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
