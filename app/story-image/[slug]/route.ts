import { getPublishedStory } from "@/lib/content";

export const runtime = "edge";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await context.params;
  const story = await getPublishedStory(slug);
  if (!story) return new Response("Not found", { status: 404 });

  const category = escapeXml(story.category.replaceAll("_", " "));
  const lines = wrapHeadline(story.headline, 31).slice(0, 4);
  const accent = categoryAccent(story.category);
  const headline = lines
    .map(
      (line, index) =>
        `<text x="92" y="${250 + index * 78}" class="headline">${escapeXml(line)}</text>`,
    )
    .join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-label="${escapeXml(story.headline)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#07111f"/>
      <stop offset="1" stop-color="#17263b"/>
    </linearGradient>
    <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse">
      <path d="M64 0H0V64" fill="none" stroke="#ffffff" stroke-opacity=".055"/>
    </pattern>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <rect width="1600" height="900" fill="url(#grid)"/>
  <circle cx="1370" cy="120" r="310" fill="${accent}" fill-opacity=".16"/>
  <circle cx="1460" cy="790" r="390" fill="${accent}" fill-opacity=".11"/>
  <path d="M910 760 C1080 620 1180 680 1320 500 S1480 360 1600 300" fill="none" stroke="${accent}" stroke-width="14"/>
  <g fill="none" stroke="#ffffff" stroke-opacity=".32" stroke-width="2">
    <path d="M1020 190H1490"/><path d="M1120 250H1540"/><path d="M980 310H1410"/>
  </g>
  <text x="92" y="92" class="brand">NORTHLINE</text>
  <text x="92" y="150" class="category">${category}</text>
  ${headline}
  <text x="92" y="810" class="footer">VERIFIED REPORTING • CONTEXT • WHAT COMES NEXT</text>
  <style>
    .brand{font:800 38px Arial,sans-serif;letter-spacing:10px;fill:#fff}
    .category{font:700 26px Arial,sans-serif;letter-spacing:5px;fill:${accent}}
    .headline{font:700 58px Georgia,serif;fill:#fff}
    .footer{font:700 18px Arial,sans-serif;letter-spacing:4px;fill:#c9d6e5}
  </style>
</svg>`;

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}

function wrapHeadline(value: string, maximum: number): string[] {
  const words = value.trim().split(/\s+/u);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maximum && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function categoryAccent(category: string): string {
  const values: Record<string, string> = {
    TECHNOLOGY: "#7aa2ff",
    BUSINESS: "#58d6b2",
    ENTERTAINMENT: "#ff7aa8",
    SPORTS: "#ffb45f",
    GAMING: "#a88cff",
    SCIENCE: "#56c8e8",
    INTERNET_TRENDS: "#f2785c",
    WEATHER: "#70b7ff",
  };
  return values[category] ?? "#f2785c";
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
