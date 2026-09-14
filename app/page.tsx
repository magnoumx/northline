import type { Metadata } from "next";
import { HomePage } from "@/components/home-page";
import { getBrandConfig } from "@/lib/brand/config";
import { resolveSiteOrigin } from "@/lib/site/origin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * The homepage was the only page type shipping without a canonical tag, and its
 * description was the 25-character brand tagline - "A clearer way to keep up." -
 * which names no subject, no country and not even the word "news". Neither the
 * title nor the description gave a crawler or a reader anything to match a query
 * against, on the one URL most likely to be crawled first.
 */
export async function generateMetadata(): Promise<Metadata> {
  const brand = getBrandConfig();
  const origin = await resolveSiteOrigin();
  const title = `${brand.name} — US news, traced to the source`;
  const description =
    "US news, sports, entertainment and weather reporting, with the sources behind every story listed on the page.";

  return {
    title: {
      absolute: title,
    },
    description,
    // Relative, resolved against `metadataBase`. Every other page type on this
    // site canonicalises with a path; passing an absolute origin here produced
    // no tag at all.
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: brand.name,
      url: origin,
      title,
      description,
      images: [
        {
          url: `${origin}/og.png`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
  };
}

export default function Home() {
  return <HomePage />;
}
