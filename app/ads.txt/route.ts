import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export function GET() {
  if (process.env.FEATURE_ADSENSE !== "true") {
    return new NextResponse("Not configured", { status: 404 });
  }
  const publisherId = normalizePublisherId(process.env.ADSENSE_CLIENT_ID);
  if (!publisherId) {
    return new NextResponse("Not configured", { status: 404 });
  }

  const content = `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0`;
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function normalizePublisherId(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  const match = /^(?:ca-)?(pub-\d{10,30})$/u.exec(normalized);
  return match?.[1] ?? null;
}
