import type { MetadataRoute } from "next";
import { LUXCARS_CONFIG } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // El portal interno no se indexa.
        disallow: ["/portal/", "/api/"],
      },
    ],
    sitemap: `${LUXCARS_CONFIG.contact.website}/sitemap.xml`,
    host: LUXCARS_CONFIG.contact.website,
  };
}
