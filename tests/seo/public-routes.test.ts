import { describe, expect, it } from "vitest";
import {
  PERSONAL_NOINDEX_ROUTES,
  publicRouteMetadata,
  STATIC_PUBLIC_ROUTES,
} from "../../lib/site/public-routes";

describe("public route metadata", () => {
  it("returns canonical + open graph metadata for promoted routes", () => {
    const meta = publicRouteMetadata("corrections");
    expect(meta).toEqual({
      title: "Corrections policy",
      description: expect.any(String),
      alternates: { canonical: "/corrections" },
      openGraph: {
        type: "website",
        title: "Corrections policy",
        description: expect.any(String),
        url: "/corrections",
        siteName: "Northline",
        locale: "en_US",
        // The page-level openGraph block replaces the root one, so the share image
        // has to be declared here or every static route shares as a blank card.
        images: [{ url: "/og.png", width: 1200, height: 630 }],
      },
    });
  });

  it("returns null for routes without first-class metadata", () => {
    expect(publicRouteMetadata("nonexistent-route")).toBeNull();
  });

  it("keeps personal/app-state routes out of the indexable static set", () => {
    for (const route of PERSONAL_NOINDEX_ROUTES) {
      expect(STATIC_PUBLIC_ROUTES[route]).toBeUndefined();
    }
  });

  it("exposes canonical metadata for every trust page required at launch", () => {
    const required = [
      "about",
      "contact",
      "editorial-standards",
      "ai-policy",
      "corrections",
      "ownership",
      "privacy",
      "cookies",
      "terms",
    ];
    for (const route of required) {
      expect(publicRouteMetadata(route)).not.toBeNull();
    }
  });
});
