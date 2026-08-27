import type { SearchProvider, SearchResponse } from "./search-provider.interface";
import { env } from "../../config";
import { redis } from "../../lib/redis";

/**
 * SearchProvider implementation using the Tavily Search API.
 * Integrates raw content scraping for deep evidence analysis.
 */
export class TavilySearchProvider implements SearchProvider {
  /**
   * Queries the Tavily Search API endpoint.
   * If TAVILY_API_KEY is not defined, returns rich mock fallbacks to facilitate offline development.
   */
  async search(query: string, options?: { limit?: number }): Promise<SearchResponse> {
    const limit = options?.limit ?? env.RESEARCH_MAX_RESULTS_PER_QUERY ?? 5;
    const cacheKey = `search:${query.toLowerCase().trim()}`;

    // Read search from Redis Cache if available
    try {
      if (redis.status === "ready") {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log(`[Redis cache hit] search results for query: "${query}"`);
          return JSON.parse(cached);
        }
      }
    } catch (err) {
      console.warn("⚠️ Redis search cache read error:", err);
    }

    // Developer / Offline Mock Fallback Strategy
    if (!env.TAVILY_API_KEY || env.TAVILY_API_KEY.trim() === "") {
      console.log(`⚠️ TAVILY_API_KEY is missing. Providing development mock search results for: "${query}"`);
      
      return {
        results: [
          {
            title: `Factual overview of ${query}`,
            url: `https://scout-mock-source.org/fact-sheet/1`,
            snippet: `Extract of research showing standard parameters and statistics relating to: "${query}".`,
            rawContent: `This page contains comprehensive data points about "${query}". Factual findings indicate that grid storage technologies are growing rapidly, with lithium-ion retaining 85% of market share despite safety concerns. Flow batteries offer longer lifecycles but suffer from lower round-trip efficiency (around 65% to 75%).`,
            publishedAt: new Date().toISOString(),
          },
          {
            title: `Environmental impacts and study: ${query}`,
            url: `https://scout-mock-source.org/fact-sheet/2`,
            snippet: `Secondary reference document outlining environmental footprints and resource bottlenecks.`,
            rawContent: `Secondary text. Mining resources like lithium and vanadium generates significant water footprint stress in arid areas. Extraction operations in South America require millions of liters per ton, creating conflicts with local agriculture and ecosystems.`,
            publishedAt: new Date().toISOString(),
          },
        ],
      };
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: env.TAVILY_API_KEY,
          query,
          max_results: limit,
          include_raw_content: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily API responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      const results = (data.results || []).map((item: any) => ({
        title: item.title || "Untitled Source",
        url: item.url || "",
        snippet: item.content || null,
        rawContent: item.raw_content || item.content || "",
        publishedAt: item.published_date || null,
        sourceMetadata: {
          score: item.score,
        },
      }));

      const responseResults = { results };

      // Cache search results in Redis for 1 hour
      try {
        if (redis.status === "ready") {
          await redis.set(cacheKey, JSON.stringify(responseResults), "EX", 3600);
        }
      } catch (err) {
        console.warn("⚠️ Redis search cache write error:", err);
      }

      return responseResults;
    } catch (err: any) {
      const error = new Error(`Tavily search invocation failed: ${err.message}`);
      (error as any).code = "SEARCH_PROVIDER_ERROR";
      throw error;
    }
  }
}
export default TavilySearchProvider;
