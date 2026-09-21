"use client";

import React from "react";
import { DAGNode } from "../../lib/dag-transform";

interface NodeInspectorDrawerProps {
  node: DAGNode | null;
  onClose: () => void;
}

export const NodeInspectorDrawer: React.FC<NodeInspectorDrawerProps> = ({ node, onClose }) => {
  if (!node) return null;

  const getStatusBadge = (status: DAGNode["status"]) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200";
      case "RUNNING":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 animate-pulse";
      case "FAILED":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200";
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Node Inspector • [{node.agentType}]
          </span>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {node.title}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        <div>
          <label className="text-[10px] font-medium uppercase text-slate-400">Status</label>
          <div className="mt-1">
            <span
              className={`inline-block rounded-md border px-2.5 py-1 font-semibold ${getStatusBadge(
                node.status
              )}`}
            >
              {node.status}
            </span>
          </div>
        </div>

        {node.inputContext && (
          <div>
            <label className="text-[10px] font-medium uppercase text-slate-400">Input Context</label>
            <div className="mt-1 rounded-md bg-slate-50 p-3 font-mono text-[11px] text-slate-800 dark:bg-slate-850 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800">
              {node.inputContext}
            </div>
          </div>
        )}

        {node.outputPayload && (
          <div>
            <label className="text-[10px] font-medium uppercase text-slate-400">Output Payload</label>
            <pre className="mt-1 max-h-60 overflow-x-auto rounded-md bg-slate-950 p-3 font-mono text-[11px] text-emerald-400">
              {node.outputPayload}
            </pre>
          </div>
        )}

        {node.error && (
          <div>
            <label className="text-[10px] font-medium uppercase text-rose-400">Error Failure Log</label>
            <div className="mt-1 rounded-md bg-rose-50 p-3 font-mono text-[11px] text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200">
              {node.error}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <button
          onClick={onClose}
          className="w-full rounded-md bg-slate-900 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Close Inspector
        </button>
      </div>
    </div>
  );
};
