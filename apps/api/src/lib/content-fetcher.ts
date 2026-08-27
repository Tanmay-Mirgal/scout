import { env } from "../config";
import { redis } from "./redis";

/**
 * Utility to fetch external web resource page content safely.
 * Includes timeouts, size clamps, robots user-agent headers, and text normalization.
 */
export class ContentFetcher {
  /**
   * Fetches the web page content and strips HTML tags, script nodes, and extra whitespaces.
   * Returns empty string gracefully if errors are encountered (does not block pipeline).
   */
  static async fetchContent(url: string): Promise<string> {
    const timeout = env.RESEARCH_REQUEST_TIMEOUT_MS ?? 60000;
    const maxSize = env.RESEARCH_MAX_SOURCE_CONTENT_SIZE ?? 100000;
    const cacheKey = `content:${url.toLowerCase().trim()}`;

    // Read cached page content from Redis
    try {
      if (redis.status === "ready") {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log(`[Redis cache hit] page content for url: "${url}"`);
          return cached;
        }
      }
    } catch (err) {
      console.warn("⚠️ Redis content cache read error:", err);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "SCOUT Intelligence Research Bot/1.0 (+https://scout-intelligence.org)",
          "Accept": "text/html,application/xhtml+xml,text/plain",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Crawl request failed with HTTP status: ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (
        !contentType.toLowerCase().includes("text") &&
        !contentType.toLowerCase().includes("xml")
      ) {
        throw new Error(`Unsupported content type retrieved: ${contentType}`);
      }

      let text = await response.text();

      // Clean HTML tags and scripts
      text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
      text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
      text = text.replace(/<[^>]*>/g, " ");
      text = text.replace(/\s+/g, " ").trim();

      // Clamp text size to configured limits
      if (text.length > maxSize) {
        text = text.substring(0, maxSize);
      }

      // Cache fetched page content in Redis for 1 day
      try {
        if (redis.status === "ready" && text.trim() !== "") {
          await redis.set(cacheKey, text, "EX", 86400);
        }
      } catch (err) {
        console.warn("⚠️ Redis content cache write error:", err);
      }

      return text;
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn(`⚠️ ContentFetcher failed to retrieve "${url}": ${err.message}`);
      return ""; // Returns empty string safely
    }
  }
}
export default ContentFetcher;
