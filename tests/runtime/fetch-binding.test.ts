import { afterEach, describe, expect, it } from "vitest";
import { runtimeFetch } from "../../lib/runtime/fetch";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Cloudflare runtime fetch binding", () => {
  it("invokes the native fetch method with globalThis as its receiver", async () => {
    let receiverMatchesGlobal = false;

    globalThis.fetch = function boundRuntimeFetch(
      this: typeof globalThis,
    ): Promise<Response> {
      receiverMatchesGlobal = this === globalThis;
      return Promise.resolve(new Response("ok", { status: 200 }));
    } as typeof fetch;

    const response = await runtimeFetch("https://example.com");

    expect(response.status).toBe(200);
    expect(receiverMatchesGlobal).toBe(true);
  });
});
