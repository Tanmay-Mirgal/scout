import { describe, it, expect, vi } from "vitest";
import { AgentStreamService, AgentStreamEvent } from "../agent-stream.service";

describe("AgentStreamService", () => {
  const sessionId = "test-session-123";

  it("subscribes listener and receives published stream events", () => {
    const listener = vi.fn();

    AgentStreamService.subscribe(sessionId, listener);
    expect(AgentStreamService.getListenerCount(sessionId)).toBeGreaterThan(0);

    const testEvent: Omit<AgentStreamEvent, "timestamp"> = {
      type: "TASK_STARTED",
      sessionId,
      taskId: "task-1",
      payload: { message: "Task 1 started" },
    };

    AgentStreamService.publish(testEvent);

    expect(listener).toHaveBeenCalledTimes(1);
    const emitted = listener.mock.calls[0][0];
    expect(emitted.type).toBe("TASK_STARTED");
    expect(emitted.sessionId).toBe(sessionId);
    expect(emitted).toHaveProperty("timestamp");

    // Clean up
    AgentStreamService.unsubscribe(sessionId, listener);
    expect(AgentStreamService.getListenerCount(sessionId)).toBe(0);
  });

  it("unsubscribes listener correctly preventing memory leaks", () => {
    const listener = vi.fn();

    AgentStreamService.subscribe(sessionId, listener);
    AgentStreamService.unsubscribe(sessionId, listener);

    AgentStreamService.publish({
      type: "AGENT_COMPLETED",
      sessionId,
      agentType: "RESEARCH",
    });

    expect(listener).not.toHaveBeenCalled();
  });
});
