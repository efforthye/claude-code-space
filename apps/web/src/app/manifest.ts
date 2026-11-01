import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/lib/data/catalog";
import { siteConfig } from "@/lib/site";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { logoMark } = await getSiteSettings();
  return {
    name: `${siteConfig.name}, ${siteConfig.tagline}`,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#fbf8f4",
    theme_color: "#6b3cff",
    icons: [
      { src: `/brand/${logoMark}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `/brand/${logoMark}/icon-512.png`, sizes: "512x512", type: "image/png" },
      { src: `/brand/${logoMark}/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
