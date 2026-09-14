import { ResearchDesk } from "@/components/newsroom-console";
import { LiveResearchDesk } from "@/components/newsroom/live-research-desk";
import { NewsroomPermissionGate } from "@/components/newsroom-permission-gate";
import { resolveContentMode } from "@/lib/content";
import { getResearchWorkspaceData } from "@/lib/newsroom/editorial-read-service";

export default async function Page() {
  const live = resolveContentMode() === "DATABASE";
  const data = live ? await getResearchWorkspaceData() : null;
  return (
    <NewsroomPermissionGate
      permissions={[
        "source.manage",
        "article.create",
        "article.edit.own",
        "article.edit.any",
      ]}
    >
      {data ? <LiveResearchDesk data={data} /> : <ResearchDesk />}
    </NewsroomPermissionGate>
  );
}
