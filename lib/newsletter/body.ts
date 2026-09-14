export const NEWSLETTER_REQUEST_MAX_BYTES = 2_048;

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body exceeds the allowed size.");
    this.name = "RequestBodyTooLargeError";
  }
}

/**
 * Reads at most `maxBytes` from the actual request stream before parsing JSON.
 * Content-Length is deliberately not trusted because clients can omit or forge it.
 */
export async function readJsonBodyWithLimit(
  request: Request,
  maxBytes = NEWSLETTER_REQUEST_MAX_BYTES,
): Promise<unknown> {
  const bytes = await readBodyBytesWithLimit(request, maxBytes);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return JSON.parse(text) as unknown;
}

export async function readTextBodyWithLimit(
  request: Request,
  maxBytes = NEWSLETTER_REQUEST_MAX_BYTES,
): Promise<string> {
  const bytes = await readBodyBytesWithLimit(request, maxBytes);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function readBodyBytesWithLimit(
  request: Request,
  maxBytes = NEWSLETTER_REQUEST_MAX_BYTES,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("maxBytes must be a positive safe integer.");
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw new SyntaxError("The request body is empty.");
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}
