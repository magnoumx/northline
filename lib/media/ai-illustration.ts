import { sha256Base64Url } from "../security/crypto";

/**
 * Last-resort artwork for a story with no licensed photograph and no verified
 * rightsholder video.
 *
 * The editorial rule this implements: an illustration must never be mistakable
 * for a record of the event. Breaking news has no photograph precisely when it
 * matters most, and a synthetic image that looks like reportage would be the
 * newsroom fabricating evidence. So the prompt is constrained to abstract
 * editorial artwork - no recognisable people, no reconstructed scenes, no
 * photographic realism - and the disclosure travels with the asset rather than
 * being left to the page to remember.
 */

export const AI_ILLUSTRATION_DISCLOSURE = "AI-generated illustration";

/** Never render these; they invite a reader to treat the image as evidence. */
const FORBIDDEN_SUBJECTS =
  "no recognisable real people, no faces, no crowds, no reconstructed news " +
  "scenes, no photographic realism, no text, no logos, no flags, no weapons, " +
  "no injury, no distress";

const CATEGORY_MOTIFS: Readonly<Record<string, string>> = {
  US_NEWS: "civic architecture, layered planes, quiet institutional geometry",
  POLITICS: "interlocking angular forms, negotiation and balance",
  BUSINESS: "ascending planes, grid and ledger geometry",
  TECHNOLOGY: "circuit-like lattice, precise repeating structure",
  SCIENCE: "orbital arcs, measurement and instrumentation motifs",
  HEALTH: "soft cellular forms, calm clinical order",
  SPORTS: "motion arcs, stadium curves, kinetic diagonals",
  ENTERTAINMENT: "stage light geometry, curtain folds, marquee rhythm",
  WEATHER: "atmospheric bands, isobar curves, layered sky gradients",
  GAMING: "isometric blocks, pixel-grid rhythm",
  INTERNET_TRENDS: "network nodes, propagation ripples",
};

export type AiIllustrationInput = {
  headline: string;
  category: string;
  /** Short factual description of the topic, used to steer the composition. */
  summary: string;
};

/**
 * Builds the image prompt. The story text steers mood and motif only; it is
 * never asked to depict what happened.
 */
export function buildIllustrationPrompt(input: AiIllustrationInput): string {
  const motif =
    CATEGORY_MOTIFS[input.category.toUpperCase()] ??
    "abstract editorial geometry, restrained composition";

  const theme = input.summary
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 180);

  return [
    "Abstract editorial illustration for a newspaper, conceptual and symbolic.",
    `Visual motif: ${motif}.`,
    theme ? `Mood suggested by the subject: ${theme}.` : "",
    "Style: modern editorial vector art, flat planes with subtle grain,",
    "deep navy and slate palette with a single warm accent, generous negative",
    "space, wide 16:9 composition, museum-poster restraint.",
    `Strictly excluded: ${FORBIDDEN_SUBJECTS}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export type IllustrationRunner = (
  prompt: string,
) => Promise<Uint8Array | null>;

export type RegisterAiIllustrationInput = AiIllustrationInput & {
  database: D1Database;
  bucket: R2Bucket;
  articleVersionId: string;
  slug: string;
  run: IllustrationRunner;
  now?: Date;
};

export type AiIllustrationResult = {
  mediaId: string;
  publicUrl: string;
  storageKey: string;
  byteSize: number;
};

export async function registerAiIllustration(
  input: RegisterAiIllustrationInput,
): Promise<AiIllustrationResult | null> {
  const prompt = buildIllustrationPrompt(input);
  let bytes: Uint8Array | null = null;
  try {
    bytes = await input.run(prompt);
  } catch (error) {
    console.warn("ai_illustration_failed", {
      slug: input.slug,
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
  // An empty or implausibly small response is a failed render, not artwork.
  if (!bytes || bytes.byteLength < 2_048) return null;

  // The model returns JPEG despite the request shape, and a stored extension
  // that disagrees with the bytes is a content-type lie the browser has to
  // work around. Trust the magic bytes, not the model.
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const contentType = isPng ? "image/png" : "image/jpeg";
  const extension = isPng ? "png" : "jpg";

  const now = (input.now ?? new Date()).getTime();
  const checksum = await sha256Base64Url(
    `northline-ai-illustration:${input.articleVersionId}:${bytes.byteLength}`,
  );
  const mediaId = `media_ai_${checksum.slice(0, 32)}`;
  const storageKey = `generated/ai-illustration/${input.slug}-${checksum.slice(0, 12)}.${extension}`;
  const publicUrl = `/media/${storageKey}`;

  await input.bucket.put(storageKey, bytes, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  const caption = `${AI_ILLUSTRATION_DISCLOSURE}. Not a photograph of the event.`;

  await input.database.batch([
    input.database
      .prepare(
        `INSERT OR IGNORE INTO media_assets (
           id, storage_key, public_url, workflow_state, mime_type, byte_size,
           width, height, checksum_sha256, creator, copyright_owner,
           original_url, license, license_url, usage_permission, attribution,
           downloaded_at, verification_state, created_at, updated_at
         ) VALUES (
           ?1, ?2, ?3, 'APPROVED', ?8, ?4, 1280, 720, ?5,
           'Northline', 'Northline', NULL, 'AI_GENERATED', NULL,
           'LICENSED_REUSE', ?6, ?7, 'VERIFIED', ?7, ?7
         )`,
      )
      .bind(
        mediaId,
        storageKey,
        publicUrl,
        bytes.byteLength,
        checksum,
        caption,
        now,
        contentType,
      ),
    input.database
      .prepare(
        `INSERT OR IGNORE INTO article_media (
           article_version_id, media_asset_id, role, position, alt_text,
           caption, created_at
         ) VALUES (?1, ?2, 'HERO', 0, ?3, ?4, ?5)`,
      )
      .bind(
        input.articleVersionId,
        mediaId,
        // Alt text describes the artwork, never the event.
        `Abstract editorial illustration accompanying: ${input.headline}`,
        caption,
        now,
      ),
  ]);

  return { mediaId, publicUrl, storageKey, byteSize: bytes.byteLength };
}

/** Workers AI transport. Kept separate so the policy above stays testable. */
export function workersAiRunner(ai: {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
}): IllustrationRunner {
  return async (prompt) => {
    // Asked for at 16:9. A square render in a wide frame letterboxes every
    // card, which is what produced the bands of dead space on the homepage.
    const response = (await ai.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt,
      steps: 6,
      width: 1280,
      height: 720,
    })) as { image?: string } | ReadableStream | null;

    if (response && typeof response === "object" && "image" in response) {
      const base64 = String(response.image ?? "");
      if (!base64) return null;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    }
    if (response instanceof ReadableStream) {
      return new Uint8Array(await new Response(response).arrayBuffer());
    }
    return null;
  };
}
