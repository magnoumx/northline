import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Story } from "@/lib/site/types";

export function PageIntro({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: React.ReactNode;
}) {
  return (
    <header className="page-intro shell">
      <div>
        <p className="story-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {aside ? <aside>{aside}</aside> : null}
    </header>
  );
}

export function StoryBreadcrumbs({ story }: { story: Story }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link href="/">Home</Link>
      <ChevronRight aria-hidden="true" />
      <Link href={`/topics/${toPublicSlug(story.category)}`}>
        {story.category}
      </Link>
      <ChevronRight aria-hidden="true" />
      <span aria-current="page">Story</span>
    </nav>
  );
}

export function DemoDataNote() {
  return (
    <p className="demo-data-note">
      Fictional product-preview data. Labels describe interface behavior, not
      current events or live audience activity.
    </p>
  );
}

export function toPublicSlug(value: string): string {
  return value.trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}
