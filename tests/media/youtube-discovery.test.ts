import { describe, expect, it, vi } from "vitest";
import {
  buildYouTubeQuery,
  DEFAULT_RECENCY_DAYS,
  discoverOfficialVideos,
  isTrustedNewsChannel,
  planYouTubeSearch,
} from "../../lib/media/youtube-discovery";

const key = "AIzaSyExampleKeyForTestsOnly000000000000";
const now = () => new Date("2026-08-03T09:00:00.000Z");

function searchResponse(
  items: Array<{
    videoId?: string;
    channelId?: string;
    channelTitle?: string;
    title?: string;
    publishedAt?: string;
  }>,
) {
  return new Response(
    JSON.stringify({
      items: items.map((item) => ({
        id: { kind: "youtube#video", videoId: item.videoId ?? "abcdefghijk" },
        snippet: {
          channelId: item.channelId ?? "UC000000000000000000000",
          channelTitle: item.channelTitle ?? "Reuters",
          title: item.title ?? "Untitled",
          publishedAt: item.publishedAt ?? "2026-08-02T10:00:00Z",
        },
      })),
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("query construction", () => {
  it("keeps the subject and drops noise words", () => {
    const query = buildYouTubeQuery(
      "Federal Reserve holds rates",
      "The Fed Held Rates Steady For A Third Meeting",
    );
    expect(query.toLowerCase()).toContain("federal reserve");
    expect(query.split(/\s+/u).length).toBeLessThanOrEqual(12);
  });

  it("is empty when there is no subject to search for", () => {
    expect(buildYouTubeQuery("", "")).toBe("");
  });
});

describe("search planning", () => {
  it("refuses when no key is configured", () => {
    for (const candidate of [undefined, "", "   "]) {
      const plan = planYouTubeSearch({
        subject: "Federal Reserve",
        headline: "Rates hold",
        key: candidate,
        now,
      });
      expect(plan.ok, String(candidate)).toBe(false);
      if (plan.ok) return;
      expect(plan.reason).toBe("not_configured");
    }
  });

  it("refuses when there is nothing to search for", () => {
    const plan = planYouTubeSearch({ subject: "  ", headline: "", key, now });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toBe("no_subject");
  });

  it("asks only for embeddable videos from the recent past", () => {
    const plan = planYouTubeSearch({
      subject: "Federal Reserve",
      headline: "Rates hold",
      key,
      now,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const url = new URL(plan.endpoint);
    expect(url.searchParams.get("type")).toBe("video");
    // An un-embeddable video would be verified and then fail at render time.
    expect(url.searchParams.get("videoEmbeddable")).toBe("true");
    expect(url.searchParams.get("safeSearch")).toBe("strict");
    const publishedAfter = url.searchParams.get("publishedAfter") ?? "";
    const days =
      (now().getTime() - new Date(publishedAfter).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(DEFAULT_RECENCY_DAYS);
  });

  it("never puts the key in the loggable form of the request", () => {
    const plan = planYouTubeSearch({
      subject: "Federal Reserve",
      headline: "Rates hold",
      key,
      now,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    // The endpoint carries the key and is only ever passed to fetch. Anything
    // written to a log or a diagnostic uses this instead.
    expect(plan.endpoint).toContain(key);
    expect(plan.loggableEndpoint).not.toContain(key);
    expect(plan.loggableEndpoint).toContain("REDACTED");
  });
});

describe("channel trust", () => {
  it("accepts a rightsholder's own news channel", () => {
    for (const channel of ["Reuters", "BBC News", "PBS NewsHour", "C-SPAN"]) {
      expect(isTrustedNewsChannel(channel), channel).toBe(true);
    }
  });

  it("accepts the rightsholder for entertainment and sport, not only hard news", () => {
    // The archive is mostly film, television and sport. A list covering only
    // wire services matched one result in sixty.
    for (const channel of [
      "Marvel Entertainment",
      "Sony Pictures Entertainment",
      "Entertainment Tonight",
      "MLB",
      "ESPN",
      // Verbatim from a live search. The spaced "Searchlight Pictures" is not
      // the channel's actual title and matched nothing.
      "SearchlightPictures",
    ]) {
      expect(isTrustedNewsChannel(channel), channel).toBe(true);
    }
  });

  it("rejects a re-uploader that merely borrows the name", () => {
    // Embedding a re-upload puts someone else's footage on the page under a
    // channel that has no right to it.
    for (const channel of [
      "BBC News Highlights",
      "Reuters Fan Channel",
      "Daily News Clips",
      "",
    ]) {
      expect(isTrustedNewsChannel(channel), channel).toBe(false);
    }
  });

  it("rejects the churn channels a real search actually returns", () => {
    // Observed verbatim in a live search for six published headlines. These
    // outrank the rightsholder on relevance, so without the allowlist they are
    // what would end up embedded.
    for (const channel of [
      "Social Security Post",
      "Senior Rights USA",
      "Public Relief Update",
      "celebupdate231",
      "Fame chronicles",
      "TeaserCon",
      "KinoCheck.com",
      "hollywoodoutbreak",
    ]) {
      expect(isTrustedNewsChannel(channel), channel).toBe(false);
    }
  });

  it("pins a channel by id once a real one has been observed", () => {
    // A display name can be imitated; an id cannot.
    expect(
      isTrustedNewsChannel("Some Renamed Channel", new Set(["UC_real"]), "UC_real"),
    ).toBe(true);
  });
});

describe("discovery", () => {
  const input = { subject: "Federal Reserve", headline: "Rates hold", key, now };

  it("returns candidate URLs from trusted channels only", async () => {
    const fetchImpl = vi.fn(async () =>
      searchResponse([
        { videoId: "aaaaaaaaaaa", channelTitle: "Reuters" },
        { videoId: "bbbbbbbbbbb", channelTitle: "Daily News Clips" },
      ]),
    ) as unknown as typeof fetch;

    const found = await discoverOfficialVideos(input, { fetchImpl });
    expect(found.map((video) => video.videoId)).toEqual(["aaaaaaaaaaa"]);
    expect(found[0]?.sourceUrl).toBe(
      "https://www.youtube.com/watch?v=aaaaaaaaaaa",
    );
  });

  it("drops a malformed video id rather than building a broken URL", async () => {
    const fetchImpl = vi.fn(async () =>
      searchResponse([
        { videoId: "too-short" },
        { videoId: "aaaaaaaaaaa" },
      ]),
    ) as unknown as typeof fetch;

    const found = await discoverOfficialVideos(input, { fetchImpl });
    expect(found.map((video) => video.videoId)).toEqual(["aaaaaaaaaaa"]);
  });

  it("de-duplicates a video returned twice", async () => {
    const fetchImpl = vi.fn(async () =>
      searchResponse([{ videoId: "aaaaaaaaaaa" }, { videoId: "aaaaaaaaaaa" }]),
    ) as unknown as typeof fetch;

    const found = await discoverOfficialVideos(input, { fetchImpl });
    expect(found).toHaveLength(1);
  });

  it("returns nothing, and does not call the API, when unconfigured", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const found = await discoverOfficialVideos(
      { ...input, key: undefined },
      { fetchImpl },
    );
    expect(found).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns nothing rather than throwing when the API refuses", async () => {
    const quotaExceeded = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "quota" } }), {
        status: 403,
      }),
    ) as unknown as typeof fetch;
    await expect(
      discoverOfficialVideos(input, { fetchImpl: quotaExceeded }),
    ).resolves.toEqual([]);

    const unreachable = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(
      discoverOfficialVideos(input, { fetchImpl: unreachable }),
    ).resolves.toEqual([]);
  });

  it("survives a response that is not the shape the API documents", async () => {
    for (const body of ["not json", "{}", '{"items":[{}]}', '{"items":null}']) {
      const fetchImpl = vi.fn(
        async () => new Response(body, { status: 200 }),
      ) as unknown as typeof fetch;
      await expect(
        discoverOfficialVideos(input, { fetchImpl }),
      ).resolves.toEqual([]);
    }
  });
});
