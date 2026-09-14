import { ReviewWorkspace } from "@/components/newsroom-console";
import { LiveReviewWorkspace } from "@/components/newsroom/live-review-workspace";
import { NewsroomPermissionGate } from "@/components/newsroom-permission-gate";
import { resolveContentMode } from "@/lib/content";
import { getReviewWorkspaceData } from "@/lib/newsroom/editorial-read-service";

export default async function Page() {
  const live = resolveContentMode() === "DATABASE";
  const data = live ? await getReviewWorkspaceData() : null;
  return (
    <NewsroomPermissionGate
      permissions={["article.approve", "article.edit.any", "audit.view"]}
    >
      {data ? <LiveReviewWorkspace data={data} /> : <ReviewWorkspace />}
    </NewsroomPermissionGate>
  );
}
