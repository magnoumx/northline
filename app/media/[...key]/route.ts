import { getR2Binding } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Serves generated artwork from the media bucket.
 *
 * Only the generated prefix is reachable. The bucket also holds licensed and
 * quarantined material whose reuse terms differ per asset, and a route that
 * served any key would turn a storage path into a distribution licence.
 */
const SERVABLE_PREFIX = "generated/";

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const { key } = await context.params;
  const objectKey = key.join("/");

  if (
    !objectKey.startsWith(SERVABLE_PREFIX) ||
    objectKey.includes("..") ||
    objectKey.includes("//")
  ) {
    return new Response("Not found", { status: 404 });
  }

  const extension = objectKey.split(".").pop()?.toLowerCase() ?? "";
  if (!CONTENT_TYPES[extension]) {
    return new Response("Not found", { status: 404 });
  }

  const bucket = await getR2Binding("MEDIA");
  const object = await bucket?.get(objectKey);
  if (!object) return new Response("Not found", { status: 404 });

  // The stored extension can disagree with the bytes - an image model may
  // return JPEG for a request shaped as PNG - and a wrong content type is a
  // header the browser has to work around. The bytes decide.
  const body = await object.arrayBuffer();
  const head = new Uint8Array(body.slice(0, 4));
  const contentType =
    head[0] === 0x89 && head[1] === 0x50
      ? "image/png"
      : head[0] === 0xff && head[1] === 0xd8
        ? "image/jpeg"
        : CONTENT_TYPES[extension];

  return new Response(body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
