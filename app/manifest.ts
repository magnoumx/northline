import type { MetadataRoute } from "next";
import { getBrandConfig } from "@/lib/brand/config";

export default function manifest(): MetadataRoute.Manifest {
  const brand = getBrandConfig();
  return {
    name: brand.name,
    short_name: brand.shortName,
    description: brand.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf6",
    theme_color: "#151613",
    categories: ["news", "magazines"],
  };
}
