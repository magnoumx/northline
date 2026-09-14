import type { ReactNode } from "react";
import { ReaderAnalytics } from "./reader-analytics";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export function PageShell({
  children,
  articleId,
}: {
  children: ReactNode;
  /** Present on article pages so reading depth can be attributed. */
  articleId?: string;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter />
      <ReaderAnalytics articleId={articleId} />
    </>
  );
}
