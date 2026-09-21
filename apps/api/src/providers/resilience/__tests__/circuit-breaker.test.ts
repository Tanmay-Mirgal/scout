import { describe, it, expect, beforeEach, vi } from "vitest";
import { CircuitBreaker } from "../circuit-breaker";

describe("CircuitBreaker State Machine", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: "TestProvider",
      failureThreshold: 2,
      resetTimeoutMs: 100,
    });
  });

  it("starts in CLOSED state and allows execution", () => {
    expect(breaker.getState()).toBe("CLOSED");
    expect(breaker.canExecute()).toBe(true);
  });

  it("transitions to OPEN state after reaching failure threshold", () => {
    breaker.recordFailure();
    expect(breaker.getState()).toBe("CLOSED");
    expect(breaker.canExecute()).toBe(true);

    breaker.recordFailure(); // Threshold hit (2)
    expect(breaker.getState()).toBe("OPEN");
    expect(breaker.canExecute()).toBe(false);
  });

  it("transitions from OPEN to HALF_OPEN after reset timeout", async () => {
    breaker.recordFailure();
    breaker.recordFailure(); // Circuit opens
    expect(breaker.getState()).toBe("OPEN");

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(breaker.getState()).toBe("HALF_OPEN");
    expect(breaker.canExecute()).toBe(true);
  });

  it("resets to CLOSED state upon recording a success", () => {
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe("OPEN");

    breaker.recordSuccess();
    expect(breaker.getState()).toBe("CLOSED");
    expect(breaker.canExecute()).toBe(true);
  });
});
