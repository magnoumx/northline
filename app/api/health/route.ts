import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      check: "liveness",
      service: "northline-web",
      milestone: "v3-production-candidate",
      dependencies: "not_checked",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
