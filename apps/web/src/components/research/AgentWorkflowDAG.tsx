"use client";

import React, { useState } from "react";
import { buildAgentDAG, DAGNode, NodeStatus } from "../../lib/dag-transform";
import { NodeInspectorDrawer } from "./NodeInspectorDrawer";

interface AgentWorkflowDAGProps {
  sessionTitle: string;
  tasks: Array<{ id: string; title: string; status: NodeStatus }>;
}

export const AgentWorkflowDAG: React.FC<AgentWorkflowDAGProps> = ({ sessionTitle, tasks }) => {
  const [selectedNode, setSelectedNode] = useState<DAGNode | null>(null);
  const topology = buildAgentDAG(sessionTitle, tasks);

  const getNodeBorderColor = (status: NodeStatus) => {
    switch (status) {
      case "COMPLETED":
        return "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20";
      case "RUNNING":
        return "border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 animate-pulse";
      case "FAILED":
        return "border-rose-500 bg-rose-50/40 dark:bg-rose-950/20";
      default:
        return "border-slate-300 bg-slate-50/40 dark:border-slate-700 dark:bg-slate-800/40";
    }
  };

  return (
    <div className="relative rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Agent Workflow Topology (DAG)
          </h3>
          <p className="text-xs text-slate-500">
            Interactive multi-agent execution visualizer. Click any node to inspect prompts and outputs.
          </p>
        </div>
      </div>

      <div className="relative min-h-[300px] overflow-x-auto rounded-md bg-slate-950/95 p-6 text-white border border-slate-800">
        <svg className="absolute inset-0 h-full w-full pointer-events-none">
          {topology.edges.map((edge) => {
            const sourceNode = topology.nodes.find((n) => n.id === edge.source);
            const targetNode = topology.nodes.find((n) => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            const x1 = sourceNode.x + 160;
            const y1 = sourceNode.y + 30;
            const x2 = targetNode.x;
            const y2 = targetNode.y + 30;

            const strokeColor =
              edge.status === "COMPLETED"
                ? "#10b981"
                : edge.status === "RUNNING"
                ? "#3b82f6"
                : "#475569";

            return (
              <line
                key={edge.id}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={strokeColor}
                strokeWidth={2}
                strokeDasharray={edge.animated ? "4,4" : undefined}
              />
            );
          })}
        </svg>

        <div className="relative min-w-[900px]">
          {topology.nodes.map((node) => (
            <div
              key={node.id}
              onClick={() => setSelectedNode(node)}
              style={{ left: `${node.x}px`, top: `${node.y}px` }}
              className={`absolute w-44 cursor-pointer rounded-lg border-2 p-3 transition-all hover:scale-105 hover:shadow-lg ${getNodeBorderColor(
                node.status
              )}`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-slate-400">
                <span>{node.agentType}</span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    node.status === "COMPLETED"
                      ? "bg-emerald-400"
                      : node.status === "RUNNING"
                      ? "bg-blue-400 animate-ping"
                      : "bg-slate-500"
                  }`}
                />
              </div>
              <h4 className="mt-1 line-clamp-2 text-xs font-semibold text-slate-100">
                {node.title}
              </h4>
            </div>
          ))}
        </div>
      </div>

      <NodeInspectorDrawer node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
};
