import { vi, describe, it, expect, beforeEach } from "vitest";
import { DataScoutService } from "../datascout-chart.service";
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
      evidence: {
        update: vi.fn(),
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

describe("DataScoutService Unit & Integration Tests", () => {
  const sampleMarkdownTable = `
| Year | Battery Capacity ($M) | Adoption Rate (%) |
| --- | --- | --- |
| 2021 | 120.5 | 15.2 |
| 2022 | 180.0 | 22.8 |
| 2023 | 250.4 | 34.1 |
| 2024 | 340.2 | 48.9 |
`;

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
  });

  it("extractTabularData parses Markdown tables into typed rows and numeric columns", () => {
    const dataset = DataScoutService.extractTabularData(sampleMarkdownTable, "Battery Growth");

    expect(dataset.title).toBe("Battery Growth");
    expect(dataset.headers).toEqual(["Year", "Battery Capacity ($M)", "Adoption Rate (%)"]);
    expect(dataset.rows).toHaveLength(4);
    expect(dataset.rows[0]["Year"]).toBe(2021);
    expect(dataset.rows[0]["Battery Capacity ($M)"]).toBe(120.5);
    expect(dataset.numericColumns).toContain("Battery Capacity ($M)");
    expect(dataset.units).toBe("$M");
  });

  it("computeStatistics calculates mean, median, min, max, and sum accurately", () => {
    const numbers = [10, 20, 30, 40, 50];
    const stats = DataScoutService.computeStatistics("TestCol", numbers);

    expect(stats.count).toBe(5);
    expect(stats.sum).toBe(150);
    expect(stats.mean).toBe(30);
    expect(stats.median).toBe(30);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(50);
  });

  it("generateChartSpec creates a declarative ChartSpec object with statistics", () => {
    const spec = DataScoutService.generateChartSpec(sampleMarkdownTable, "bar", "Market Forecast 2024");

    expect(spec.chartType).toBe("bar");
    expect(spec.title).toBe("Market Forecast 2024");
    expect(spec.yAxisKeys).toContain("Battery Capacity ($M)");
    expect(spec.statistics.length).toBeGreaterThan(0);
    expect(spec.data).toHaveLength(4);
  });

  it("POST /api/v1/research-sessions/:id/charts/generate returns generated chart spec", async () => {
    const app = await buildApp();
    const sessionId = "a1b2c3d4-e5f6-7890-abcd-1234567890ab";

    (prisma.researchSession.findUnique as any).mockResolvedValue({
      id: sessionId,
      userId: "dev-user-123",
      title: "Clean Energy Transition",
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/research-sessions/${sessionId}/charts/generate`,
      payload: {
        text: sampleMarkdownTable,
        chartType: "bar",
        title: "Energy Storage Growth",
      },
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.success).toBe(true);
    expect(json.data.chartType).toBe("bar");
    expect(json.data.title).toBe("Energy Storage Growth");
    expect(json.data.data.length).toBe(4);
  });

  it("GET /api/v1/research-sessions/:id/charts scans evidence and returns charts list", async () => {
    const app = await buildApp();
    const sessionId = "a1b2c3d4-e5f6-7890-abcd-1234567890ab";

    (prisma.researchSession.findUnique as any).mockResolvedValue({
      id: sessionId,
      userId: "dev-user-123",
      title: "Clean Energy Transition",
      evidence: [
        {
          id: "ev-101",
          content: sampleMarkdownTable,
          metadata: {},
        },
      ],
    });

    (prisma.evidence.update as any).mockResolvedValue({});

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/research-sessions/${sessionId}/charts`,
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBe(1);
    expect(json.data[0].chartType).toBe("bar");
  });
});
