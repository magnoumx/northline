import { ArticleEditor } from "@/components/newsroom-console";
import { NewsroomPermissionGate } from "@/components/newsroom-permission-gate";

export default function Page() {
  return (
    <NewsroomPermissionGate
      permissions={["article.create", "article.edit.own", "article.edit.any"]}
    >
      <ArticleEditor />
    </NewsroomPermissionGate>
  );
}
