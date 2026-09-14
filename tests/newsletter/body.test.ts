import { describe, expect, it } from "vitest";
import {
  readJsonBodyWithLimit,
  RequestBodyTooLargeError,
} from "../../lib/newsletter/body";

describe("readJsonBodyWithLimit", () => {
  it("parses a JSON request beneath the actual byte cap", async () => {
    const request = new Request("https://northline.example/api/newsletter", {
      method: "POST",
      body: JSON.stringify({ email: "reader@example.com" }),
    });

    await expect(readJsonBodyWithLimit(request, 128)).resolves.toEqual({
      email: "reader@example.com",
    });
  });

  it("rejects an oversized stream even when Content-Length lies", async () => {
    const request = new Request("https://northline.example/api/newsletter", {
      method: "POST",
      headers: { "content-length": "1" },
      body: JSON.stringify({ value: "x".repeat(512) }),
    });

    await expect(readJsonBodyWithLimit(request, 64)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });

  it("measures UTF-8 bytes rather than JavaScript character count", async () => {
    const request = new Request("https://northline.example/api/newsletter", {
      method: "POST",
      body: JSON.stringify({ value: "é".repeat(20) }),
    });

    await expect(readJsonBodyWithLimit(request, 32)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });
});
