import { describe, expect, it } from "vitest";
import { servableImageUrl } from "../../lib/content/d1-public-repository";

// Two homepage cards rendered alt text instead of a photo: their stored URLs
// pointed at thumb.wikimedia.org, which the CSP does not allow, so the browser
// refused them. The files themselves were fine.
describe("servableImageUrl", () => {
  it("moves a Commons thumbnail onto the allowed host and drops tracking", () => {
    const url =
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/47/A.jpg/1920px-A.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail";
    expect(servableImageUrl(url)).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/A.jpg/1920px-A.jpg",
    );
  });

  it("keeps non-tracking query parameters", () => {
    expect(
      servableImageUrl("https://images.unsplash.com/photo-1?w=800&utm_source=x"),
    ).toBe("https://images.unsplash.com/photo-1?w=800");
  });

  it("passes the house graphic and other same-origin paths through", () => {
    expect(servableImageUrl("/story-image/some-slug")).toBe("/story-image/some-slug");
  });

  it("refuses hosts the page cannot load so the house graphic takes over", () => {
    expect(servableImageUrl("https://example.com/a.jpg")).toBeUndefined();
    expect(servableImageUrl("http://upload.wikimedia.org/a.jpg")).toBeUndefined();
    expect(servableImageUrl("not a url")).toBeUndefined();
    expect(servableImageUrl(undefined)).toBeUndefined();
  });
});
