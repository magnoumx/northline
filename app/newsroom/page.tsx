import { NewsroomDashboard } from "@/components/newsroom-console";
import { NewsroomPermissionGate } from "@/components/newsroom-permission-gate";
import { getNewsroomCandidates } from "@/lib/newsroom/editorial-read-service";

export default async function Page() {
  const candidates = await getNewsroomCandidates();
  return (
    <NewsroomPermissionGate permissions={["workspace.access"]}>
      <NewsroomDashboard candidates={candidates} />
    </NewsroomPermissionGate>
  );
}
