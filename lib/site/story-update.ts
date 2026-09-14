import type { Story } from "./types";

export function hasMeaningfulUpdate(story: Story): boolean {
  if (story.status === "Updated") return true;
  if (story.updatedAtIso && story.publishedAtIso) {
    return (
      new Date(story.updatedAtIso).getTime() -
        new Date(story.publishedAtIso).getTime() >
      60_000
    );
  }
  return story.updated.trim() !== story.published.trim();
}
