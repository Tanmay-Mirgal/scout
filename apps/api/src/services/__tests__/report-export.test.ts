import { vi, describe, it, expect, beforeEach } from "vitest";
import { ReportExportService } from "../report-export.service";
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

describe("ReportExportService Unit Tests", () => {
  const mockSources = [
    { id: "src-1", title: "Battery Grid Storage Report 2024", url: "https://example.com/battery", publisher: "Energy Institute", createdAt: new Date() },
  ];
  const mockEvidence = [
    { id: "ev-1", sourceId: "src-1", content: "Lithium-ion holds 85% market share" },
  ];

  it("exportMarkdown generates Markdown with inline citation superscripts and Bibliography", () => {
    const md = ReportExportService.exportMarkdown(
      "Energy Storage",
      "Grid Battery Market Analysis",
      "Lithium-ion holds 85% market share across modern power grids.",
      mockSources,
      mockEvidence
    );

    expect(md).toContain("# 🔎 SCOUT Research Intelligence Report");
    expect(md).toContain("Lithium-ion holds 85% market share [<sup>1</sup>](https://example.com/battery)");
    expect(md).toContain("### 📚 Bibliography & Evidence Reference Tree");
    expect(md).toContain("1. [Battery Grid Storage Report 2024](https://example.com/battery)");
  });

  it("exportHTML generates HTML document string", () => {
    const html = ReportExportService.exportHTML(
      "Energy Storage",
      "Grid Battery Market Analysis",
      "Lithium-ion holds 85% market share",
      mockSources,
      mockEvidence
    );

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>Grid Battery Market Analysis - SCOUT Intelligence Report</title>");
  });

  it("exportJSONLD generates valid Schema.org ScholarlyArticle JSON-LD", () => {
    const jsonLdStr = ReportExportService.exportJSONLD(
      "Energy Storage",
      "Grid Battery Market Analysis",
      "Lithium-ion holds 85% market share",
      mockSources,
      [{ content: "Lithium-ion holds 85% market share" }]
    );

    const jsonLd = JSON.parse(jsonLdStr);
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("ScholarlyArticle");
    expect(jsonLd.headline).toBe("Grid Battery Market Analysis");
  });
});

describe("Report Export API Routes", () => {
  let app: any;
  const validSessionId = "123e4567-e89b-12d3-a456-426614174000";
  const mockUser = { id: "user-123", email: "dev@scout.local" };
  const mockSession = {
    id: validSessionId,
    title: "Energy Storage Trends",
    userId: "user-123",
    reports: [{ title: "Final Report", content: "Battery efficiency increased in 2024" }],
    claims: [{ content: "Battery efficiency increased in 2024" }],
    evidence: [{ id: "e-1", sourceId: "s-1", content: "Battery efficiency increased" }],
    sources: [{ id: "s-1", title: "Battery Report", url: "https://example.com", createdAt: new Date() }],
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("GET /api/v1/research-sessions/:id/reports/export?format=markdown returns markdown content disposition", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(mockUser);
    (prisma.researchSession.findUnique as any).mockResolvedValue(mockSession);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/research-sessions/${validSessionId}/reports/export?format=markdown`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/markdown");
    expect(response.payload).toContain("# 🔎 SCOUT Research Intelligence Report");
  });

  it("GET /api/v1/research-sessions/:id/reports/export?format=jsonld returns json-ld header", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(mockUser);
    (prisma.researchSession.findUnique as any).mockResolvedValue(mockSession);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/research-sessions/${validSessionId}/reports/export?format=jsonld`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/ld+json");
    const jsonLd = JSON.parse(response.payload);
    expect(jsonLd["@type"]).toBe("ScholarlyArticle");
  });
});
