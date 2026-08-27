/**
 * Standardized search result format.
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string | null;
  publishedAt?: string | Date | null;
  rawContent?: string; // Opt-in raw site contents (like Tavily page text)
  sourceMetadata?: Record<string, any>;
}

/**
 * Standardized search response layout.
 */
export interface SearchResponse {
  results: SearchResult[];
}

/**
 * Interface implementing a web search provider.
 * Keeps agents isolated from third-party search APIs.
 */
export interface SearchProvider {
  /**
   * Performs a web search query.
   */
  search(query: string, options?: { limit?: number }): Promise<SearchResponse>;
}
export default SearchProvider;
