import { TrendDesk } from "@/components/newsroom-console";
import { NewsroomPermissionGate } from "@/components/newsroom-permission-gate";
import { getNewsroomTrends } from "@/lib/newsroom/editorial-read-service";

export default async function Page() {
  const trends = await getNewsroomTrends();
  return (
    <NewsroomPermissionGate permissions={["trend.manage"]}>
      <TrendDesk trends={trends} />
    </NewsroomPermissionGate>
  );
}
