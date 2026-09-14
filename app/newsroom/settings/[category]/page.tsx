import { notFound } from "next/navigation";
import { NewsroomPermissionGate } from "@/components/newsroom-permission-gate";
import { SettingsCategoryPage } from "@/components/newsroom/settings-pages";
import { isSettingsCategory } from "@/lib/settings/registry";

export default async function SettingsCategoryRoute({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isSettingsCategory(category)) notFound();
  return (
    <NewsroomPermissionGate permissions={["settings.manage"]}>
      <SettingsCategoryPage category={category} />
    </NewsroomPermissionGate>
  );
}
