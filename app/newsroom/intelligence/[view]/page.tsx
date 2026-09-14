import { notFound, redirect } from "next/navigation";
import { IntelligenceWorkbench } from "@/components/newsroom-console";
import { IntelligenceUnavailable } from "@/components/newsroom/intelligence-unavailable";
import { NewsroomPermissionGate } from "@/components/newsroom-permission-gate";
import { resolveContentMode } from "@/lib/content";
import {
  buildIntelligenceDemoViewModel,
  intelligenceViews,
  type IntelligenceView,
} from "@/lib/intelligence";

/**
 * What each view still needs before it can show a real number. Production
 * never renders the fixture model; it renders this instead.
 */
const REQUIREMENTS: Readonly<Record<string, string>> = {
  "top-content":
    "Ranking readership requires first-party analytics to have collected engaged-reading events over a stated period.",
  publishers:
    "Publisher citation analysis requires enough published articles with exact document citations to be meaningful.",
  formats:
    "Format comparison requires measured performance per format, which needs analytics coverage across several formats.",
  headlines:
    "Headline testing requires a real experiment system. None exists yet, so no results can be shown.",
  opportunities:
    "Opportunity scoring is live on the overview; this expanded view is not implemented.",
};

function isIntelligenceView(value: string): value is IntelligenceView {
  return (intelligenceViews as readonly string[]).includes(value);
}

export default async function Page({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (!isIntelligenceView(view)) notFound();
  if (view === "overview") redirect("/newsroom/intelligence");

  // Fixtures are a development aid. In production they are a lie on an
  // operator's dashboard, so they never render there.
  if (resolveContentMode() === "DATABASE") {
    return (
      <NewsroomPermissionGate permissions={["trend.manage", "audit.view"]}>
        <IntelligenceUnavailable
          view={view.replaceAll("-", " ")}
          requires={
            REQUIREMENTS[view] ??
            "This view has no live data source implemented yet."
          }
        />
      </NewsroomPermissionGate>
    );
  }

  return (
    <NewsroomPermissionGate permissions={["trend.manage", "audit.view"]}>
      <IntelligenceWorkbench
        model={buildIntelligenceDemoViewModel()}
        view={view}
      />
    </NewsroomPermissionGate>
  );
}
