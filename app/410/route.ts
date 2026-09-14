import { getBrandConfig } from "@/lib/brand/config";

export function GET() {
  const name = escapeHtml(getBrandConfig().shortName);
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>Story no longer available · ${name}</title>
  </head>
  <body>
    <main>
      <strong>410 · GONE</strong>
      <h1>This story is no longer available.</h1>
      <p>A withdrawn or retired page preserves its status instead of quietly redirecting to unrelated coverage.</p>
      <a href="/">Return to ${name}</a>
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
