export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number; // Number of consecutive failures before opening circuit
  resetTimeoutMs?: number; // Time in ms before transitioning from OPEN to HALF_OPEN
}

/**
 * Circuit Breaker state machine protecting providers from cascading failures.
 *
 * States:
 * - CLOSED: Normal operation. Requests pass through.
 * - OPEN: Failure threshold breached. Requests fail fast without calling provider.
 * - HALF_OPEN: Reset timeout expired. Allows trial requests to test provider recovery.
 */
export class CircuitBreaker {
  public readonly name: string;
  private failureThreshold: number;
  private resetTimeoutMs: number;

  private state: CircuitBreakerState = "CLOSED";
  private failureCount: number = 0;
  private nextAttemptTimestamp: number = 0;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 10000;
  }

  public getState(): CircuitBreakerState {
    if (this.state === "OPEN" && Date.now() >= this.nextAttemptTimestamp) {
      this.state = "HALF_OPEN";
    }
    return this.state;
  }

  public canExecute(): boolean {
    const currentState = this.getState();
    return currentState === "CLOSED" || currentState === "HALF_OPEN";
  }

  public recordSuccess(): void {
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  public recordFailure(): void {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold || this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.nextAttemptTimestamp = Date.now() + this.resetTimeoutMs;
    }
  }

  public reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.nextAttemptTimestamp = 0;
  }
}
