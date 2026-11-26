import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: [
          "/api/",
          "/dashboard",
          "/projects",
          "/tasks",
          "/my-tasks",
          "/calendar",
          "/personal-tasks",
          "/sticky-notes",
          "/notes",
          "/inbox",
          "/team",
          "/departments",
          "/reports",
          "/settings",
          "/pending-approval",
        ],
      },
    ],
    sitemap: "https://lakshya.dailyworkreport.com/sitemap.xml",
    host: "https://lakshya.dailyworkreport.com",
  };
}
