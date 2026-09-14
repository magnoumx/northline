interface CloudflareEnv {
  ASSETS: Fetcher;
  DB: D1Database;
  ARTICLE_AUDIO: R2Bucket;
  MEDIA: R2Bucket;
  MEDIA_QUARANTINE: R2Bucket;
  EDITORIAL_QUEUE: Queue<unknown>;
  EDITORIAL_DLQ: Queue<unknown>;
  MEDIA_QUEUE: Queue<unknown>;
  MEDIA_DLQ: Queue<unknown>;
  AD_EVENT_QUEUE: Queue<unknown>;
  AD_EVENT_DLQ: Queue<unknown>;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: {
          format: string;
          quality: number;
        }): Promise<{ response(): Response }>;
      };
    };
  };
}

declare namespace Cloudflare {
  interface Env extends CloudflareEnv {
    readonly __northlineEnvironmentBrand?: "northline";
  }
}
