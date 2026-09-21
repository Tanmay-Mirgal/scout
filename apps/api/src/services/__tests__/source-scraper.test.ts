import { vi, describe, it, expect, beforeEach } from "vitest";
import { SourceScraperService } from "../source-scraper.service";
import { buildApp } from "../../app";

// Mock Prisma Client
vi.mock("../../lib/prisma", () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      researchSession: {
        findUnique: vi.fn(),
      },
      source: {
        upsert: vi.fn(),
      },
    },
  };
});

// Mock Redis Client
vi.mock("../../lib/redis", () => {
  return {
    redis: {
      status: "ready",
      ping: vi.fn().mockResolvedValue("PONG"),
      on: vi.fn(),
    },
  };
});

import { prisma } from "../../lib/prisma";

describe("SourceScraperService Unit & Integration Tests", () => {
  const sampleHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Clean Energy Transition Whitepaper 2024</title>
  <meta property="og:title" content="Clean Energy Transition Whitepaper 2024" />
  <meta property="og:description" content="A comprehensive evaluation of renewable energy adoption rates and grid stabilization technologies." />
  <meta name="author" content="Dr. Sarah Jenkins" />
  <meta property="og:site_name" content="Department of Energy" />
  <meta property="article:published_time" content="2024-05-15T08:00:00Z" />
  <link rel="canonical" href="https://energy.gov/whitepaper-2024" />
</head>
<body>
  <h1>Clean Energy Report</h1>
  <p>Renewable energy generation has reached record capacity across global utility providers. Solar and wind installations grew by 24% year-over-year. Energy storage systems enable grid resilience during peak load demand.</p>
</body>
</html>`;

  beforeEach(() => {
    vi.clearAllMocks();

    (prisma.user.findUnique as any).mockResolvedValue({
      id: "dev-user-123",
      email: "dev@scout.local",
      name: "Dev User",
    });

    (prisma.user.create as any).mockResolvedValue({
      id: "dev-user-123",
      email: "dev@scout.local",
      name: "Dev User",
    });

    (prisma.source.upsert as any).mockResolvedValue({
      id: "source-123",
      researchSessionId: "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
      url: "https://energy.gov/whitepaper-2024",
      title: "Clean Energy Transition Whitepaper 2024",
      author: "Dr. Sarah Jenkins",
      publisher: "Department of Energy",
      publishedAt: new Date("2024-05-15T08:00:00Z"),
      credibilityScore: 90,
      metadata: { extracted: {}, credibilityBreakdown: {} },
    });
  });

  it("extractMetadata correctly parses HTML meta and OpenGraph tags", () => {
    const meta = SourceScraperService.extractMetadata(sampleHtml, "https://energy.gov/whitepaper-2024");

    expect(meta.title).toBe("Clean Energy Transition Whitepaper 2024");
    expect(meta.description).toBe("A comprehensive evaluation of renewable energy adoption rates and grid stabilization technologies.");
    expect(meta.author).toBe("Dr. Sarah Jenkins");
    expect(meta.publisher).toBe("Department of Energy");
    expect(meta.publishedAt).toBe("2024-05-15T08:00:00Z");
    expect(meta.canonicalUrl).toBe("https://energy.gov/whitepaper-2024");
    expect(meta.wordCount).toBeGreaterThan(10);
  });

  it("calculateCredibilityScore evaluates .gov domain with HTTPS and complete metadata as HIGH tier", () => {
    const meta = SourceScraperService.extractMetadata(sampleHtml, "https://energy.gov/whitepaper-2024");
    const score = SourceScraperService.calculateCredibilityScore("https://energy.gov/whitepaper-2024", meta);

    expect(score.domainTrust).toBe(30); // .gov TLD
    expect(score.protocolSecurity).toBe(15); // HTTPS
    expect(score.metadataCompleteness).toBe(35); // Title, desc, author, date, canonical
    expect(score.totalScore).toBeGreaterThanOrEqual(75);
    expect(score.tier).toBe("HIGH");
  });

  it("calculateCredibilityScore evaluates HTTP non-trusted domain with minimal metadata as LOW or UNVERIFIED tier", () => {
    const minimalMeta = {
      title: "http://untrusted-blog.com/post",
      wordCount: 15,
    };
    const score = SourceScraperService.calculateCredibilityScore("http://untrusted-blog.com/post", minimalMeta as any);

    expect(score.domainTrust).toBe(15); // .com
    expect(score.protocolSecurity).toBe(0); // HTTP
    expect(score.metadataCompleteness).toBe(0);
    expect(score.totalScore).toBeLessThan(50);
  });

  it("POST /api/v1/research-sessions/:id/sources/scrape returns scraped source metadata and credibility report", async () => {
    const app = await buildApp();
    const sessionId = "a1b2c3d4-e5f6-7890-abcd-1234567890ab";

    (prisma.researchSession.findUnique as any).mockResolvedValue({
      id: sessionId,
      userId: "dev-user-123",
      title: "Clean Energy Transition Research",
    });

    (prisma.source.upsert as any).mockResolvedValue({
      id: "source-123",
      researchSessionId: sessionId,
      url: "https://energy.gov/whitepaper-2024",
      title: "Clean Energy Transition Whitepaper 2024",
      author: "Dr. Sarah Jenkins",
      publisher: "Department of Energy",
      publishedAt: new Date("2024-05-15T08:00:00Z"),
      credibilityScore: 90,
      metadata: { extracted: {}, credibilityBreakdown: {} },
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/research-sessions/${sessionId}/sources/scrape`,
      payload: {
        url: "https://energy.gov/whitepaper-2024",
        htmlContent: sampleHtml,
      },
    });

    const json = response.json();
    expect(response.statusCode).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.sourceId).toBe("source-123");
    expect(json.data.credibilityScore).toBeGreaterThanOrEqual(75);
    expect(json.data.extractedMetadata.title).toBe("Clean Energy Transition Whitepaper 2024");
    expect(json.data.credibilityBreakdown.tier).toBe("HIGH");
  });
});
