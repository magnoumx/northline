import { notFound } from "next/navigation";
import { AdvertisingOperationsPage } from "@/components/newsroom/advertising-page";
import {
  advertisingSections,
  type AdvertisingSection,
} from "@/components/newsroom/advertising-data";
import { NewsroomPermissionGate } from "@/components/newsroom-permission-gate";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!advertisingSections.includes(section as AdvertisingSection)) {
    notFound();
  }

  return (
    <NewsroomPermissionGate permissions={["ad.manage"]}>
      <AdvertisingOperationsPage section={section as AdvertisingSection} />
    </NewsroomPermissionGate>
  );
}
