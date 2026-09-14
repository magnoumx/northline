import { describe, expect, it, vi } from "vitest";
import {
  selectEditorialVideo,
  verifyEditorialVideo,
  videoRelevanceScore,
} from "../../lib/media/video-verification";

const oEmbedOk = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("editorial video verification", () => {
  it("embeds only after the platform confirms the video", async () => {
    const fetchImpl = vi.fn(async () =>
      oEmbedOk({
        title: "Full replay: the final stage sprint",
        author_name: "Tour de France",
        author_url: "https://www.youtube.com/@tourdefrance",
        thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      }),
    ) as unknown as typeof fetch;

    const video = await verifyEditorialVideo(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      { fetchImpl },
    );

    expect(video).not.toBeNull();
    // Title and channel come from the platform, never from a model.
    expect(video?.title).toBe("Full replay: the final stage sprint");
    expect(video?.publisher).toBe("Tour de France");
    expect(video?.embedUrl).toContain("youtube-nocookie.com/embed/");
  });

  it("rejects a video that is private, deleted, or embedding-disabled", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("", { status: 401 }),
    ) as unknown as typeof fetch;

    const video = await verifyEditorialVideo(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      { fetchImpl },
    );

    expect(video).toBeNull();
  });

  it("rejects a platform with no public embed contract", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    const video = await verifyEditorialVideo(
      "https://news.example.com/story/video",
      { fetchImpl },
    );

    expect(video).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("scores an unrelated video below the selection threshold", () => {
    const related = videoRelevanceScore(
      { title: "Colton Smith wins in three sets", publisher: "ATP Tour" },
      "colton smith",
      "Colton Smith Is America's Most Unlikely Tennis Star",
    );
    const unrelated = videoRelevanceScore(
      { title: "Weekly market wrap", publisher: "Finance Daily" },
      "colton smith",
      "Colton Smith Is America's Most Unlikely Tennis Star",
    );

    expect(related).toBeGreaterThanOrEqual(0.5);
    expect(unrelated).toBeLessThan(0.5);
  });

  it("skips candidates that do not clear the relevance threshold", async () => {
    const fetchImpl = vi.fn(async () =>
      oEmbedOk({ title: "Weekly market wrap", author_name: "Finance Daily" }),
    ) as unknown as typeof fetch;

    const chosen = await selectEditorialVideo(
      ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
      { subject: "colton smith", headline: "Colton Smith wins again" },
      { fetchImpl },
    );

    expect(chosen).toBeNull();
  });
});
