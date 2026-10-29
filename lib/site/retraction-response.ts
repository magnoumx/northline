/**
 * Retracted stories answered with the generic 404 page, the same as a URL that
 * never existed. All 29 retracted articles had been published, so a reader or
 * crawler following an old link learned nothing about the retraction the
 * corrections policy promises to keep on record. A 410 with a notice says the
 * page was removed on purpose and points at the public corrections record.
 */

const STORY_PATH = /^\/story\/([a-z0-9][a-z0-9-]{0,200})$/u;

/** The slug of a story URL, or null for any other path. */
export function storySlugFromPath(pathname: string): string | null {
  return STORY_PATH.exec(pathname)?.[1] ?? null;
}

/** True when the article was public once and has since been retracted. */
export function isRetractedPublication(
  row: { state: string; publishedAt: number | null } | null,
): boolean {
  return row?.state === "RETRACTED" && row.publishedAt !== null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => `&#${character.charCodeAt(0)};`);
}

export function retractedStoryResponse(siteName: string): Response {
  const name = escapeHtml(siteName);
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex,follow">
    <title>Story retracted · ${name}</title>
  </head>
  <body>
    <main>
      <strong>410 · RETRACTED</strong>
      <h1>This story was retracted.</h1>
      <p>${name} withdrew this article after publication. The retraction is kept on the public record.</p>
      <p><a href="/corrections">Read the corrections and retractions record</a> · <a href="/">Return to ${name}</a></p>
    </main>
  </body>
</html>`;
  return new Response(html, {
    status: 410,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

/** Plain-http requests for the production host move to https. */
export function httpsRedirectTarget(url: URL, productionHost: string): string | null {
  if (url.protocol !== "http:") return null;
  if (url.hostname.toLowerCase() !== productionHost) return null;
  const target = new URL(url.toString());
  target.protocol = "https:";
  return target.toString();
}
