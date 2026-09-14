import { getBrandConfig } from "@/lib/brand/config";
import { getPublicContentSnapshot, resolveContentMode } from "@/lib/content/read-service";
import { distinctSubjects } from "@/lib/site/search-suggestions";
import { SiteHeaderClient } from "./site-header-client";

export async function SiteHeader() {
  const demoMode = resolveContentMode() === "DEMO_FIXTURES";
  // Real subjects from what is actually published, not a static example that
  // drifts from whatever the site currently covers.
  const { stories } = await getPublicContentSnapshot();
  const suggestedSearches = distinctSubjects(stories.flatMap((story) => story.topics)).slice(0, 4);
  return (
    <SiteHeaderClient
      brand={getBrandConfig()}
      demoMode={demoMode}
      suggestedSearches={suggestedSearches}
    />
  );
}
