import { describe, it, expect } from "vitest";
import { buildAgentDAG } from "../dag-transform";

describe("dag-transform Utility", () => {
  it("builds a multi-level DAG topology with Orchestrator, Task, Critic, and Synthesis nodes", () => {
    const sessionTitle = "AI Battery Storage Analysis";
    const tasks = [
      { id: "task-1", title: "Analyze Lithium Grid Share", status: "COMPLETED" as const },
      { id: "task-2", title: "Compare Thermal Storage Costs", status: "COMPLETED" as const },
    ];

    const topology = buildAgentDAG(sessionTitle, tasks);

    expect(topology.nodes).toHaveLength(5); // Orchestrator + 2 Tasks + Critic + Synthesis
    expect(topology.nodes[0].agentType).toBe("ORCHESTRATOR");
    expect(topology.nodes[0].status).toBe("COMPLETED");

    expect(topology.nodes[1].title).toBe("Analyze Lithium Grid Share");
    expect(topology.nodes[2].title).toBe("Compare Thermal Storage Costs");

    expect(topology.nodes[3].agentType).toBe("CRITIC");
    expect(topology.nodes[4].agentType).toBe("SYNTHESIS");

    // Verify connecting directed edges
    expect(topology.edges.length).toBeGreaterThan(3);
  });

  it("assigns RUNNING status to animated graph edges when tasks are in progress", () => {
    const tasks = [
      { id: "task-1", title: "In Progress Task", status: "RUNNING" as const },
    ];

    const topology = buildAgentDAG("Live Execution", tasks);

    const taskEdge = topology.edges.find((e) => e.target === "task-task-1");
    expect(taskEdge).toBeDefined();
    expect(taskEdge?.animated).toBe(true);
    expect(taskEdge?.status).toBe("RUNNING");
  });
});
