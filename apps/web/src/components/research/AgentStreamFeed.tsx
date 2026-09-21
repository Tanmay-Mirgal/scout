"use client";

import React from "react";
import { useAgentStream, StreamEventPayload } from "../../lib/hooks/useAgentStream";

interface AgentStreamFeedProps {
  sessionId: string;
}

export const AgentStreamFeed: React.FC<AgentStreamFeedProps> = ({ sessionId }) => {
  const { events, isStreaming, error, clearEvents } = useAgentStream(sessionId);

  const getEventBadgeColor = (type: StreamEventPayload["type"]) => {
    switch (type) {
      case "CONNECTED":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
      case "TASK_STARTED":
      case "AGENT_STARTED":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
      case "AGENT_PROGRESS":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
      case "TASK_COMPLETED":
      case "AGENT_COMPLETED":
      case "SESSION_COMPLETED":
        return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
      case "TASK_FAILED":
      case "AGENT_FAILED":
        return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-3 w-3">
            {isStreaming && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex h-3 w-3 rounded-full ${
                isStreaming ? "bg-emerald-500" : "bg-slate-400"
              }`}
            ></span>
          </span>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Live Agent Execution Activity Stream
          </h3>
        </div>

        <button
          onClick={clearEvents}
          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          Clear Feed
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {error}
        </div>
      )}

      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Waiting for agent activity events...
          </div>
        ) : (
          events.map((evt, idx) => (
            <div
              key={`${evt.timestamp}-${idx}`}
              className="flex items-start justify-between rounded-md border border-slate-100 bg-slate-50/50 p-2.5 text-xs dark:border-slate-800/60 dark:bg-slate-800/30"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${getEventBadgeColor(
                      evt.type
                    )}`}
                  >
                    {evt.type}
                  </span>
                  {evt.agentType && (
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      [{evt.agentType}]
                    </span>
                  )}
                </div>

                {evt.payload?.agentName && (
                  <p className="text-slate-600 dark:text-slate-400">
                    {evt.payload.agentName}: {evt.payload.query || evt.payload.error || "Step execution"}
                  </p>
                )}
              </div>

              <span className="text-[10px] font-mono text-slate-400">
                {new Date(evt.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
