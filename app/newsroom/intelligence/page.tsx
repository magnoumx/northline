import { IntelligenceWorkbench } from "@/components/newsroom-console";
import { LiveIntelligenceWorkbench } from "@/components/newsroom/live-intelligence-workbench";
import { IntelligenceUnavailable } from "@/components/newsroom/intelligence-unavailable";
import { NewsroomPermissionGate } from "@/components/newsroom-permission-gate";
import { resolveContentMode } from "@/lib/content";
import { buildIntelligenceDemoViewModel } from "@/lib/intelligence";
import { getIntelligenceWorkspaceData } from "@/lib/newsroom/editorial-read-service";

export default async function Page() {
  const live = resolveContentMode() === "DATABASE";
  const data = live ? await getIntelligenceWorkspaceData() : null;
  return (
    <NewsroomPermissionGate permissions={["trend.manage", "audit.view"]}>
      {data ? (
        <LiveIntelligenceWorkbench data={data} />
      ) : live ? (
        // Database mode with no workspace data is a real failure, not a cue to
        // show fixtures.
        <IntelligenceUnavailable
          view="the intelligence overview"
          requires="The newsroom database returned no workspace data. Check D1 health before relying on this page."
        />
      ) : (
        <IntelligenceWorkbench model={buildIntelligenceDemoViewModel()} view="overview" />
      )}
    </NewsroomPermissionGate>
  );
}
