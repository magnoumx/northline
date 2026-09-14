/**
 * IndexNow submission.
 *
 * Search engines discover a new article when they next crawl the sitemap, which
 * for a young domain can be days. IndexNow inverts that: the publication tells
 * Bing, Yandex, Seznam and Naver the moment a URL changes, and they fetch it.
 * Google does not participate, but a Bing-indexed article is still an article
 * people can find, and the protocol costs one request per publication.
 *
 * Two rules keep this from becoming spam, which is the only way to lose access
 * to the protocol:
 *
 *  1. A URL is submitted when it genuinely changed - published, corrected, or
 *     withdrawn - never on a schedule and never repeatedly for the same state.
 *  2. Only URLs on the verified host are ever submitted.
 */

export type IndexNowSubmission = {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
};

export type IndexNowRefusal = {
  reason: "not_configured" | "no_urls" | "foreign_host" | "too_many";
  detail: string;
};

export type IndexNowPlan =
  | { ok: true; submission: IndexNowSubmission }
  | { ok: false; refusal: IndexNowRefusal };

/** The protocol caps a single submission at 10,000 URLs. */
export const MAXIMUM_URLS_PER_SUBMISSION = 10_000;

/** A key is a 8-128 character hexadecimal string, by specification. */
export function isValidIndexNowKey(value: string): boolean {
  return /^[a-f0-9]{8,128}$/iu.test(value.trim());
}

export function planIndexNowSubmission(input: {
  urls: readonly string[];
  siteUrl: string | undefined;
  key: string | undefined;
}): IndexNowPlan {
  const key = input.key?.trim() ?? "";
  if (!key || !isValidIndexNowKey(key)) {
    return {
      ok: false,
      refusal: {
        reason: "not_configured",
        detail: "No valid IndexNow key is configured.",
      },
    };
  }

  let host: string;
  try {
    host = new URL(input.siteUrl ?? "").hostname;
  } catch {
    return {
      ok: false,
      refusal: {
        reason: "not_configured",
        detail: "The public site URL is not a valid absolute URL.",
      },
    };
  }

  // Submitting a URL on a host we do not control is how a key gets revoked.
  const sameHost: string[] = [];
  for (const candidate of input.urls) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "https:") continue;
      if (parsed.hostname !== host) {
        return {
          ok: false,
          refusal: {
            reason: "foreign_host",
            detail: `${parsed.hostname} is not ${host}.`,
          },
        };
      }
      sameHost.push(parsed.toString());
    } catch {
      // A malformed URL is dropped rather than submitted.
    }
  }

  const unique = [...new Set(sameHost)];
  if (unique.length === 0) {
    return {
      ok: false,
      refusal: { reason: "no_urls", detail: "Nothing changed to submit." },
    };
  }
  if (unique.length > MAXIMUM_URLS_PER_SUBMISSION) {
    return {
      ok: false,
      refusal: {
        reason: "too_many",
        detail: `${unique.length} URLs exceeds the ${MAXIMUM_URLS_PER_SUBMISSION} limit.`,
      },
    };
  }

  return {
    ok: true,
    submission: {
      host,
      key,
      keyLocation: `https://${host}/${key}.txt`,
      urlList: unique,
    },
  };
}

export type IndexNowResult =
  | { ok: true; submitted: number; status: number }
  | { ok: false; status: number; detail: string };

/**
 * Sends the submission.
 *
 * A 200 or 202 means accepted. A 403 means the key file could not be verified,
 * which is a configuration fault worth surfacing rather than retrying, and a
 * 422 means the URLs did not match the key's host.
 */
export async function submitToIndexNow(
  submission: IndexNowSubmission,
  fetchImpl: typeof fetch = fetch,
): Promise<IndexNowResult> {
  let response: Response;
  try {
    response = await fetchImpl("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(submission),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      detail: error instanceof Error ? error.message.slice(0, 160) : "unreachable",
    };
  }

  if (response.status === 200 || response.status === 202) {
    return { ok: true, submitted: submission.urlList.length, status: response.status };
  }

  return {
    ok: false,
    status: response.status,
    detail:
      response.status === 403
        ? "The key file could not be verified at its stated location."
        : response.status === 422
          ? "A submitted URL did not belong to the key's host."
          : `IndexNow returned ${response.status}.`,
  };
}
