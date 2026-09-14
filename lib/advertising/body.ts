export class AdvertisingBodyError extends Error {
  constructor(readonly kind: "TOO_LARGE" | "INVALID_JSON") {
    super(kind);
  }
}

export async function readAdvertisingJson(
  request: Request,
  maximumBytes = 32_768,
): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maximumBytes) {
    throw new AdvertisingBodyError("TOO_LARGE");
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maximumBytes) {
    throw new AdvertisingBodyError("TOO_LARGE");
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new AdvertisingBodyError("INVALID_JSON");
  }
}

