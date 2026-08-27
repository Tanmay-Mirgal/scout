import type { SearchProvider } from "./search-provider.interface";
import { TavilySearchProvider } from "./tavily-search.provider";

let searchProviderInstance: SearchProvider | null = null;

/**
 * Access factory to retrieve the configured Search provider.
 * Instantiates the TavilySearchProvider singleton.
 */
export function getSearchProvider(): SearchProvider {
  if (!searchProviderInstance) {
    searchProviderInstance = new TavilySearchProvider();
  }
  return searchProviderInstance;
}

/**
 * Resets the cached search provider instance (useful in testing).
 */
export function resetSearchProvider(): void {
  searchProviderInstance = null;
}

export * from "./search-provider.interface";
