import { describe, it, expect, vi } from "vitest";
import { ResilienceProviderManager } from "../resilience-provider.manager";
import type { AIProvider } from "../../core/ai-provider.interface";
import type { ProviderRequest, ProviderResponse } from "../../core/provider.types";

describe("ResilienceProviderManager Failover", () => {
  const dummyRequest: ProviderRequest = {
    messages: [{ role: "user", content: "Test research query" }],
  };

  it("returns primary provider response when primary provider succeeds", async () => {
    const primaryProvider: AIProvider = {
      name: "Primary",
      providerType: "PRIMARY",
      generate: vi.fn().mockResolvedValue({ content: "Primary success", model: "p-1" }),
      generateStructured: vi.fn(),
    };

    const secondaryProvider: AIProvider = {
      name: "Secondary",
      providerType: "SECONDARY",
      generate: vi.fn().mockResolvedValue({ content: "Secondary fallback", model: "s-1" }),
      generateStructured: vi.fn(),
    };

    const manager = new ResilienceProviderManager([primaryProvider, secondaryProvider]);
    const res = await manager.generate(dummyRequest);

    expect(res.content).toBe("Primary success");
    expect(primaryProvider.generate).toHaveBeenCalledTimes(1);
    expect(secondaryProvider.generate).not.toHaveBeenCalled();
  });

  it("automatically fails over to secondary provider when primary fails", async () => {
    const failingPrimary: AIProvider = {
      name: "FailingPrimary",
      providerType: "PRIMARY",
      generate: vi.fn().mockRejectedValue(new Error("HTTP 429 Rate Limit Exceeded")),
      generateStructured: vi.fn(),
    };

    const backupProvider: AIProvider = {
      name: "BackupProvider",
      providerType: "BACKUP",
      generate: vi.fn().mockResolvedValue({ content: "Backup success", model: "b-1" }),
      generateStructured: vi.fn(),
    };

    const manager = new ResilienceProviderManager([failingPrimary, backupProvider]);
    const res = await manager.generate(dummyRequest);

    expect(res.content).toBe("Backup success");
    expect(failingPrimary.generate).toHaveBeenCalledTimes(1);
    expect(backupProvider.generate).toHaveBeenCalledTimes(1);
  });

  it("throws aggregated error when all providers in chain fail", async () => {
    const p1: AIProvider = {
      name: "P1",
      providerType: "P1",
      generate: vi.fn().mockRejectedValue(new Error("P1 error")),
      generateStructured: vi.fn(),
    };

    const p2: AIProvider = {
      name: "P2",
      providerType: "P2",
      generate: vi.fn().mockRejectedValue(new Error("P2 error")),
      generateStructured: vi.fn(),
    };

    const manager = new ResilienceProviderManager([p1, p2]);
    await expect(manager.generate(dummyRequest)).rejects.toThrow(
      "All AI providers in resilience chain failed"
    );
  });
});
