import { describe, it, expect, beforeEach, vi } from "vitest";
import { EmbeddingService } from "../embedding.service";
import { HybridSearchService } from "../hybrid-search.service";

describe("EmbeddingService", () => {
  it("generates a 1536-dimensional normalized vector by default", async () => {
    const vector = await EmbeddingService.generateEmbedding("Lithium-ion batteries grid storage");
    expect(vector).toHaveLength(1536);

    // Verify vector magnitude L2 norm equals 1.0 (normalized)
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 4);
  });

  it("produces deterministic vectors for identical inputs", async () => {
    const v1 = EmbeddingService.generateDeterministicVector("artificial intelligence research");
    const v2 = EmbeddingService.generateDeterministicVector("artificial intelligence research");
    expect(v1).toEqual(v2);
  });

  it("produces different vectors for distinct text inputs", async () => {
    const v1 = EmbeddingService.generateDeterministicVector("quantum computing tech");
    const v2 = EmbeddingService.generateDeterministicVector("renewable solar energy adoption");
    expect(v1).not.toEqual(v2);
  });

  it("formats vector array into PostgreSQL pgvector string syntax", () => {
    const pgStr = EmbeddingService.toPgVectorString([0.1, 0.2, 0.3]);
    expect(pgStr).toBe("[0.1,0.2,0.3]");
  });
});

describe("HybridSearchService - Reciprocal Rank Fusion (RRF)", () => {
  const sampleVectorResults = [
    { id: "ev-1", score: 0.95, item: { id: "ev-1", content: "Battery storage growth", relevanceScore: 0.9 } },
    { id: "ev-2", score: 0.85, item: { id: "ev-2", content: "Solar power adoption", relevanceScore: 0.8 } },
  ];

  const sampleKeywordResults = [
    { id: "ev-2", score: 0.90, item: { id: "ev-2", content: "Solar power adoption", relevanceScore: 0.8 } },
    { id: "ev-3", score: 0.70, item: { id: "ev-3", content: "Wind energy capacity", relevanceScore: 0.75 } },
  ];

  it("fuses vector and keyword rankings using RRF math correctly", () => {
    const fused = HybridSearchService.fuseRRF(sampleVectorResults, sampleKeywordResults, 0.5, 10);
    expect(fused).toHaveLength(3);

    // ev-2 appears in both vector and keyword results, so its RRF score should be highest
    expect(fused[0].id).toBe("ev-2");
    expect(fused[0].combinedScore).toBeGreaterThan(0);
    expect(fused[0].vectorScore).toBe(0.85);
    expect(fused[0].keywordScore).toBe(0.9);
  });

  it("respects alpha weight prioritizing pure vector or pure keyword search", () => {
    // With alpha = 1.0 (pure vector), ev-1 (rank 1 in vector) should rank highest
    const pureVectorFused = HybridSearchService.fuseRRF(sampleVectorResults, sampleKeywordResults, 1.0, 10);
    expect(pureVectorFused[0].id).toBe("ev-1");

    // With alpha = 0.0 (pure keyword), ev-2 (rank 1 in keyword) should rank highest
    const pureKeywordFused = HybridSearchService.fuseRRF(sampleVectorResults, sampleKeywordResults, 0.0, 10);
    expect(pureKeywordFused[0].id).toBe("ev-2");
  });
});
