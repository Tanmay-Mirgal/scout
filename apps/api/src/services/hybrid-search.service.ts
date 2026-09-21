import { prisma } from "../lib/prisma";
import { EmbeddingService } from "./embedding.service";

export interface SearchEvidenceOptions {
  sessionId: string;
  query: string;
  limit?: number;
  alpha?: number; // 0.0 = pure keyword, 1.0 = pure vector, 0.5 = equal RRF weight
  minRelevanceScore?: number;
}

export interface HybridSearchResultItem {
  id: string;
  content: string;
  summary: string | null;
  location: string | null;
  relevanceScore: number | null;
  confidenceScore: number | null;
  sourceId: string;
  researchSessionId: string;
  combinedScore: number;
  vectorScore: number;
  keywordScore: number;
  createdAt: Date;
}

export class HybridSearchService {
  private static readonly RRF_K = 60; // Standard constant for Reciprocal Rank Fusion

  /**
   * Generates vector embedding for an evidence record and persists it to PostgreSQL pgvector column.
   */
  public static async attachEmbeddingToEvidence(
    evidenceId: string,
    content: string
  ): Promise<void> {
    const vector = await EmbeddingService.generateEmbedding(content);
    const vectorStr = EmbeddingService.toPgVectorString(vector);

    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "evidence" SET "embedding" = $1::vector WHERE "id" = $2`,
        vectorStr,
        evidenceId
      );
    } catch {
      // Gracefully store vector in metadata if pgvector extension is uninitialized in dev/sqlite mocks
      const evidence = await prisma.evidence.findUnique({ where: { id: evidenceId } });
      if (evidence) {
        const existingMeta = (evidence.metadata as Record<string, any>) || {};
        await prisma.evidence.update({
          where: { id: evidenceId },
          data: {
            metadata: {
              ...existingMeta,
              vectorEmbedding: vector,
            },
          },
        });
      }
    }
  }

  /**
   * Performs hybrid RAG retrieval combining vector cosine similarity & keyword matching using RRF.
   */
  public static async searchEvidence(
    options: SearchEvidenceOptions
  ): Promise<HybridSearchResultItem[]> {
    const { sessionId, query, limit = 10, alpha = 0.5, minRelevanceScore = 0 } = options;
    const queryVector = await EmbeddingService.generateEmbedding(query);

    // 1. Execute Vector Similarity Search
    const vectorResults = await this.executeVectorSearch(sessionId, query, queryVector, limit * 2);

    // 2. Execute Keyword / Text Search
    const keywordResults = await this.executeKeywordSearch(sessionId, query, limit * 2);

    // 3. Perform Reciprocal Rank Fusion (RRF)
    const fusedResults = this.fuseRRF(vectorResults, keywordResults, alpha, limit);

    // 4. Apply minRelevanceScore filter if specified
    return fusedResults.filter(
      (item) => (item.relevanceScore ?? 1.0) >= minRelevanceScore
    );
  }

  /**
   * Vector similarity search using pgvector raw SQL with fallback to in-memory cosine distance.
   */
  private static async executeVectorSearch(
    sessionId: string,
    queryText: string,
    queryVector: number[],
    take: number
  ): Promise<Array<{ id: string; score: number; item: any }>> {
    const vectorStr = EmbeddingService.toPgVectorString(queryVector);

    try {
      // pgvector cosine similarity distance query (1 - cosine distance)
      const rawRows: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, content, summary, location, "relevanceScore", "confidenceScore", "sourceId", "researchSessionId", "createdAt",
                (1 - (embedding <=> $1::vector)) as similarity
         FROM "evidence"
         WHERE "researchSessionId" = $2 AND embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector ASC
         LIMIT $3`,
        vectorStr,
        sessionId,
        take
      );

      return rawRows.map((row) => ({
        id: row.id,
        score: Number(row.similarity) || 0,
        item: row,
      }));
    } catch {
      // Fallback: Fetch evidence records for session and compute vector similarity using metadata vector or fallback
      const allEvidence = await prisma.evidence.findMany({
        where: { researchSessionId: sessionId },
        take: take * 3,
      });

      const scored = allEvidence.map((item) => {
        let itemVector: number[];
        const meta = item.metadata as Record<string, any> | null;
        if (meta?.vectorEmbedding && Array.isArray(meta.vectorEmbedding)) {
          itemVector = meta.vectorEmbedding;
        } else {
          itemVector = EmbeddingService.generateDeterministicVector(item.content);
        }

        const score = this.cosineSimilarity(queryVector, itemVector);
        return { id: item.id, score, item };
      });

      return scored.sort((a, b) => b.score - a.score).slice(0, take);
    }
  }

  /**
   * Keyword search using PostgreSQL text search / Prisma ILIKE filtering.
   */
  private static async executeKeywordSearch(
    sessionId: string,
    queryText: string,
    take: number
  ): Promise<Array<{ id: string; score: number; item: any }>> {
    const terms = queryText.toLowerCase().trim().split(/\s+/).filter(Boolean);

    const items = await prisma.evidence.findMany({
      where: {
        researchSessionId: sessionId,
        OR: [
          { content: { contains: queryText, mode: "insensitive" } },
          { summary: { contains: queryText, mode: "insensitive" } },
          ...terms.map((term) => ({ content: { contains: term, mode: "insensitive" as const } })),
        ],
      },
      take,
      orderBy: { createdAt: "desc" },
    });

    return items.map((item, index) => {
      // Compute term frequency score based on match count
      let matchCount = 0;
      const lowerContent = item.content.toLowerCase();
      const lowerSummary = (item.summary || "").toLowerCase();

      for (const term of terms) {
        if (lowerContent.includes(term)) matchCount += 2;
        if (lowerSummary.includes(term)) matchCount += 3;
      }

      const score = matchCount > 0 ? Math.min(1.0, 0.2 + matchCount * 0.15) : 1 / (index + 1);

      return { id: item.id, score, item };
    });
  }

  /**
   * Merges vector and keyword search rankings using Reciprocal Rank Fusion (RRF).
   * RRF score = alpha * (1 / (k + rank_vector)) + (1 - alpha) * (1 / (k + rank_keyword))
   */
  public static fuseRRF(
    vectorResults: Array<{ id: string; score: number; item: any }>,
    keywordResults: Array<{ id: string; score: number; item: any }>,
    alpha: number,
    limit: number
  ): HybridSearchResultItem[] {
    const itemMap = new Map<string, any>();
    const vectorRanks = new Map<string, number>();
    const keywordRanks = new Map<string, number>();
    const vectorScores = new Map<string, number>();
    const keywordScores = new Map<string, number>();

    vectorResults.forEach((res, rank) => {
      itemMap.set(res.id, res.item);
      vectorRanks.set(res.id, rank + 1);
      vectorScores.set(res.id, res.score);
    });

    keywordResults.forEach((res, rank) => {
      if (!itemMap.has(res.id)) {
        itemMap.set(res.id, res.item);
      }
      keywordRanks.set(res.id, rank + 1);
      keywordScores.set(res.id, res.score);
    });

    const combinedScores: Array<{ id: string; score: number }> = [];

    itemMap.forEach((_, id) => {
      const vRank = vectorRanks.get(id);
      const kRank = keywordRanks.get(id);

      const vRRF = vRank ? 1 / (this.RRF_K + vRank) : 0;
      const kRRF = kRank ? 1 / (this.RRF_K + kRank) : 0;

      const score = alpha * vRRF + (1 - alpha) * kRRF;
      combinedScores.push({ id, score });
    });

    combinedScores.sort((a, b) => b.score - a.score);

    return combinedScores.slice(0, limit).map(({ id, score }) => {
      const raw = itemMap.get(id);
      return {
        id: raw.id,
        content: raw.content,
        summary: raw.summary ?? null,
        location: raw.location ?? null,
        relevanceScore: raw.relevanceScore ?? null,
        confidenceScore: raw.confidenceScore ?? null,
        sourceId: raw.sourceId,
        researchSessionId: raw.researchSessionId,
        combinedScore: Number(score.toFixed(6)),
        vectorScore: Number((vectorScores.get(id) || 0).toFixed(4)),
        keywordScore: Number((keywordScores.get(id) || 0).toFixed(4)),
        createdAt: raw.createdAt,
      };
    });
  }

  /**
   * Mathematical cosine similarity utility for 2 vectors.
   */
  private static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : Math.max(0, Math.min(1, dot / denom));
  }
}
