import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Story } from "@/lib/site/types";
import { categoryTopic } from "@/lib/editorial/topic-derivation";

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
  // Readers saw "Home / US_NEWS / Story": the enum, and a placeholder where
  // the page's own name belongs.
  const topic = categoryTopic(story.category);
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link href="/">Home</Link>
      <ChevronRight aria-hidden="true" />
      <Link href={`/topics/${topic.slug}`}>{topic.name}</Link>
      <ChevronRight aria-hidden="true" />
      <span aria-current="page">{story.headline}</span>
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
