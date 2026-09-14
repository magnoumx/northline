import { AdvertisingOperationsPage } from "@/components/newsroom/advertising-page";
import { NewsroomPermissionGate } from "@/components/newsroom-permission-gate";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <NewsroomPermissionGate permissions={["ad.manage"]}>
      <AdvertisingOperationsPage />
    </NewsroomPermissionGate>
  );
}
