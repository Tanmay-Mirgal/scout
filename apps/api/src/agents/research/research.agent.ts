import { z } from "zod";
import { BaseAgent } from "../core/base.agent";
import type { AgentContext, AgentResult } from "../core/agent.types";
import { getSearchProvider } from "../../providers/search";
import { env } from "../../config";

// Validation schema for generated search queries
export const searchQueriesSchema = z.object({
  queries: z
    .array(z.string().min(1, "Search query cannot be empty"))
    .min(1, "Must generate at least one search query.")
    .max(5, "Cannot generate more than 5 search queries."),
});

/**
 * Research Agent responsible for understanding research objectives,
 * generating search queries, and invoking the search provider layer.
 */
export class ResearchAgent extends BaseAgent {
  readonly name = "Research Agent";
  readonly type = "RESEARCH";
  readonly description = "Generates targeted search queries and gathers candidate web search results.";

  async execute(context: AgentContext): Promise<AgentResult> {
    const provider = this.getProvider();
    const searchProvider = getSearchProvider();
    const maxQueries = env.RESEARCH_MAX_SEARCH_QUERIES_PER_TASK ?? 3;

    const systemPrompt = `You are the SCOUT Research Agent. 
Your goal is to analyze a research task objective and generate up to ${maxQueries} specific web search queries to retrieve fact sheets, documentations, and study resources.
Do not generate repetitive queries.
Your output MUST be a valid JSON object strictly matching the schema format:
{
  "queries": [
    "first search query string",
    "second search query string"
  ]
}`;

    const userPrompt = `Research Task: "${context.query}"\nDescription: "${context.context || ""}"`;

    try {
      const { queries } = await provider.generateStructured(
        {
          messages: [{ role: "user", content: userPrompt }],
          systemPrompt,
          temperature: 0.3,
        },
        searchQueriesSchema
      );

      // Clamp generated query count to configured safety limits
      const activeQueries = queries.slice(0, maxQueries);
      
      const allResults: any[] = [];
      for (const q of activeQueries) {
        const searchResponse = await searchProvider.search(q, {
          limit: env.RESEARCH_MAX_RESULTS_PER_QUERY ?? 5,
        });
        allResults.push(...searchResponse.results);
      }

      // First-pass deduplication based on normalized URL
      const seenUrls = new Set<string>();
      const uniqueResults = allResults.filter((res) => {
        if (!res.url || res.url.trim() === "") {
          return false;
        }
        // Normalize URL by removing trailing slash and converting to lowercase
        const normalized = res.url.toLowerCase().trim().replace(/\/$/, "");
        if (seenUrls.has(normalized)) {
          return false;
        }
        seenUrls.add(normalized);
        return true;
      });

      return {
        success: true,
        output: JSON.stringify(uniqueResults),
        metadata: {
          queriesGenerated: activeQueries,
          resultsCount: uniqueResults.length,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        output: "",
        error: `Research Agent execution failed: ${err.message}`,
        metadata: {
          code: err.code || "RESEARCH_EXECUTION_FAILED",
        },
      };
    }
  }
}
export default ResearchAgent;
