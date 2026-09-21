"use client";

import { useEffect, useState, useCallback } from "react";

export interface StreamEventPayload {
  type:
    | "CONNECTED"
    | "SESSION_STARTED"
    | "TASK_STARTED"
    | "TASK_COMPLETED"
    | "TASK_FAILED"
    | "AGENT_STARTED"
    | "AGENT_PROGRESS"
    | "AGENT_COMPLETED"
    | "AGENT_FAILED"
    | "SESSION_COMPLETED"
    | "HEARTBEAT";
  sessionId: string;
  taskId?: string;
  agentType?: string;
  timestamp: string;
  payload?: any;
}

export function useAgentStream(sessionId: string | undefined) {
  const [events, setEvents] = useState<StreamEventPayload[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const streamUrl = `${apiUrl}/api/v1/research-sessions/${sessionId}/stream`;

    setIsStreaming(true);
    setError(null);

    const eventSource = new EventSource(streamUrl);

    const handleEvent = (event: MessageEvent) => {
      try {
        const parsed: StreamEventPayload = JSON.parse(event.data);
        setEvents((prev) => [...prev, parsed]);

        if (parsed.type === "SESSION_COMPLETED") {
          setIsStreaming(false);
          eventSource.close();
        }
      } catch {
        // Ignore unparseable frames
      }
    };

    // Attach listeners for all event types
    const eventTypes = [
      "CONNECTED",
      "SESSION_STARTED",
      "TASK_STARTED",
      "TASK_COMPLETED",
      "TASK_FAILED",
      "AGENT_STARTED",
      "AGENT_PROGRESS",
      "AGENT_COMPLETED",
      "AGENT_FAILED",
      "SESSION_COMPLETED",
    ];

    eventTypes.forEach((type) => {
      eventSource.addEventListener(type, handleEvent);
    });

    eventSource.onopen = () => {
      setIsStreaming(true);
      setError(null);
    };

    eventSource.onerror = () => {
      setError("Event stream connection lost. Retrying...");
      setIsStreaming(false);
    };

    return () => {
      eventTypes.forEach((type) => {
        eventSource.removeEventListener(type, handleEvent);
      });
      eventSource.close();
      setIsStreaming(false);
    };
  }, [sessionId]);

  return { events, isStreaming, error, clearEvents };
}
