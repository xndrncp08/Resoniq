import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/mailer";

// Read at request time so the sitemap URL uses the deployment's origin, not the build machine's.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/api/og/"], disallow: ["/admin", "/api/", "/settings", "/notifications", "/bookmarks", "/library", "/new", "/analyze", "/appeals"] },
    sitemap: `${appOrigin()}/sitemap.xml`,
  };
}
