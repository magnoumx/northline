export type EditorialEmbedProvider =
  | "YouTube"
  | "Vimeo"
  | "TikTok"
  | "Facebook"
  | "Instagram"
  | "X";

export type EditorialEmbed = {
  provider: EditorialEmbedProvider;
  embedUrl: string;
  sourceUrl: string;
  title: string;
  aspect: "landscape" | "portrait" | "social";
};

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/u;
const NUMERIC_ID = /^\d{6,24}$/u;
const SHORTCODE = /^[A-Za-z0-9_-]{5,32}$/u;

export function normalizeEditorialEmbed(
  value: string | undefined,
  title = "Source media",
): EditorialEmbed | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase().replace(/^www\./u, "");

    const youtubeId = youtubeVideoId(url, hostname);
    if (youtubeId) {
      return {
        provider: "YouTube",
        embedUrl:
          `https://www.youtube-nocookie.com/embed/${youtubeId}` +
          "?rel=0&playsinline=1",
        sourceUrl: canonicalSourceUrl(url),
        title,
        aspect: "landscape",
      };
    }

    const vimeoId = vimeoVideoId(url, hostname);
    if (vimeoId) {
      return {
        provider: "Vimeo",
        embedUrl:
          `https://player.vimeo.com/video/${vimeoId}` +
          "?dnt=1&title=1&byline=1&portrait=0",
        sourceUrl: canonicalSourceUrl(url),
        title,
        aspect: "landscape",
      };
    }

    const tiktokId = tiktokVideoId(url, hostname);
    if (tiktokId) {
      return {
        provider: "TikTok",
        embedUrl:
          `https://www.tiktok.com/player/v1/${tiktokId}` +
          "?controls=1&progress_bar=1&play_button=1&volume_control=1" +
          "&fullscreen_button=1&timestamp=1&autoplay=0&rel=0&description=1",
        sourceUrl: canonicalSourceUrl(url),
        title,
        aspect: "portrait",
      };
    }

    const instagram = instagramPost(url, hostname);
    if (instagram) {
      return {
        provider: "Instagram",
        embedUrl:
          `https://www.instagram.com/${instagram.kind}/${instagram.code}` +
          "/embed/captioned/",
        sourceUrl: canonicalSourceUrl(url),
        title,
        aspect: "portrait",
      };
    }

    const facebook = facebookVideo(url, hostname);
    if (facebook) {
      const sourceUrl = canonicalSourceUrl(url);
      return {
        provider: "Facebook",
        embedUrl:
          "https://www.facebook.com/plugins/video.php?show_text=0&width=1280" +
          `&href=${encodeURIComponent(sourceUrl)}`,
        sourceUrl,
        title,
        aspect: "landscape",
      };
    }

    const xPostId = xPost(url, hostname);
    if (xPostId) {
      return {
        provider: "X",
        embedUrl:
          `https://platform.twitter.com/embed/Tweet.html?id=${xPostId}` +
          "&dnt=true&theme=dark",
        sourceUrl: canonicalSourceUrl(url),
        title,
        aspect: "social",
      };
    }
  } catch {
    return null;
  }

  return null;
}

function youtubeVideoId(url: URL, hostname: string): string | null {
  let candidate = "";
  if (hostname === "youtu.be") {
    candidate = url.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (
    hostname === "youtube.com" ||
    hostname === "m.youtube.com" ||
    hostname === "youtube-nocookie.com"
  ) {
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v") ?? "";
    } else if (["embed", "shorts", "live"].includes(parts[0] ?? "")) {
      candidate = parts[1] ?? "";
    }
  }
  return YOUTUBE_ID.test(candidate) ? candidate : null;
}

function vimeoVideoId(url: URL, hostname: string): string | null {
  if (hostname !== "vimeo.com" && hostname !== "player.vimeo.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const candidate = parts[0] === "video" ? parts[1] ?? "" : parts[0] ?? "";
  return NUMERIC_ID.test(candidate) ? candidate : null;
}

function tiktokVideoId(url: URL, hostname: string): string | null {
  if (hostname !== "tiktok.com" && hostname !== "m.tiktok.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const videoIndex = parts.indexOf("video");
  const playerIndex = parts.indexOf("v1");
  const candidate =
    videoIndex >= 0
      ? parts[videoIndex + 1] ?? ""
      : playerIndex >= 0
        ? parts[playerIndex + 1] ?? ""
        : "";
  return NUMERIC_ID.test(candidate) ? candidate : null;
}

function instagramPost(
  url: URL,
  hostname: string,
): { kind: "p" | "reel" | "tv"; code: string } | null {
  if (hostname !== "instagram.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const kind = parts[0];
  const code = parts[1] ?? "";
  if (!["p", "reel", "tv"].includes(kind) || !SHORTCODE.test(code)) return null;
  return { kind: kind as "p" | "reel" | "tv", code };
}

function facebookVideo(url: URL, hostname: string): boolean {
  if (
    hostname !== "facebook.com" &&
    hostname !== "m.facebook.com" &&
    hostname !== "fb.watch"
  ) {
    return false;
  }
  if (hostname === "fb.watch") return url.pathname.length > 1;
  return (
    url.pathname.includes("/videos/") ||
    url.pathname.startsWith("/watch") ||
    url.pathname.startsWith("/reel/") ||
    Boolean(url.searchParams.get("v"))
  );
}

function xPost(url: URL, hostname: string): string | null {
  if (hostname !== "x.com" && hostname !== "twitter.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const statusIndex = parts.indexOf("status");
  const candidate = statusIndex >= 0 ? parts[statusIndex + 1] ?? "" : "";
  return NUMERIC_ID.test(candidate) ? candidate : null;
}

function canonicalSourceUrl(url: URL): string {
  url.hash = "";
  return url.toString();
}
