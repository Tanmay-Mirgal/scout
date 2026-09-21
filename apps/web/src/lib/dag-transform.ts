export type NodeStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";

export interface DAGNode {
  id: string;
  title: string;
  agentType: string;
  status: NodeStatus;
  x: number;
  y: number;
  level: number;
  inputContext?: string;
  outputPayload?: string;
  durationMs?: number;
  error?: string;
}

export interface DAGEdge {
  id: string;
  source: string;
  target: string;
  animated: boolean;
  status: NodeStatus;
}

export interface DAGTopology {
  nodes: DAGNode[];
  edges: DAGEdge[];
}

/**
 * Transforms raw research session tasks and agent execution runs into an interactive
 * Directed Acyclic Graph (DAG) topology with coordinates and edge statuses.
 */
export function buildAgentDAG(
  sessionTitle: string,
  tasks: Array<{ id: string; title: string; status: NodeStatus; priority?: string }>,
  agentRuns: Array<{ id: string; agentType: string; status: string; input?: any; output?: any; error?: string; startedAt?: string; completedAt?: string }> = []
): DAGTopology {
  const nodes: DAGNode[] = [];
  const edges: DAGEdge[] = [];

  const LEVEL_SPACING_X = 220;
  const NODE_SPACING_Y = 110;
  const START_X = 50;
  const START_Y = 100;

  // Level 0: Orchestrator Node
  const orchestratorId = "node-orchestrator";
  const orchestratorStatus: NodeStatus =
    tasks.length > 0 && tasks.every((t) => t.status === "COMPLETED")
      ? "COMPLETED"
      : tasks.some((t) => t.status === "RUNNING")
      ? "RUNNING"
      : "PENDING";

  nodes.push({
    id: orchestratorId,
    title: "Orchestrator Scout",
    agentType: "ORCHESTRATOR",
    status: orchestratorStatus,
    x: START_X,
    y: START_Y,
    level: 0,
    inputContext: `Research Question: ${sessionTitle}`,
    outputPayload: `Decomposed into ${tasks.length} research sub-tasks.`,
  });

  // Level 1: Task Nodes (Research / Source Scouts)
  tasks.forEach((task, idx) => {
    const taskId = `task-${task.id}`;
    const posY = START_Y + (idx - (tasks.length - 1) / 2) * NODE_SPACING_Y;

    // Find associated agent run
    const matchedRun = agentRuns.find((r) => r.agentType === "RESEARCH" || r.agentType === "SOURCE");

    nodes.push({
      id: taskId,
      title: task.title,
      agentType: "RESEARCH",
      status: task.status,
      x: START_X + LEVEL_SPACING_X,
      y: posY,
      level: 1,
      inputContext: `Task Prompt: ${task.title}`,
      outputPayload: matchedRun?.output ? JSON.stringify(matchedRun.output, null, 2) : undefined,
      error: matchedRun?.error,
    });

    // Edge from Orchestrator to Task Node
    edges.push({
      id: `edge-orchestrator-${taskId}`,
      source: orchestratorId,
      target: taskId,
      animated: task.status === "RUNNING",
      status: task.status,
    });
  });

  // Level 2: Critic / Verification Node
  const criticId = "node-critic";
  const allTasksCompleted = tasks.length > 0 && tasks.every((t) => t.status === "COMPLETED");
  const criticStatus: NodeStatus = allTasksCompleted ? "COMPLETED" : "PENDING";

  nodes.push({
    id: criticId,
    title: "Critic / Verification Scout",
    agentType: "CRITIC",
    status: criticStatus,
    x: START_X + LEVEL_SPACING_X * 2,
    y: START_Y,
    level: 2,
    inputContext: "Cross-analyzing evidence for claim verification and contradiction checks.",
    outputPayload: allTasksCompleted ? "Claim verification complete. NLI contradiction check passed." : undefined,
  });

  // Connect level 1 tasks to Critic Node
  tasks.forEach((task) => {
    edges.push({
      id: `edge-task-${task.id}-critic`,
      source: `task-${task.id}`,
      target: criticId,
      animated: task.status === "RUNNING",
      status: task.status,
    });
  });

  // Level 3: Synthesis Node
  const synthesisId = "node-synthesis";
  const synthesisStatus: NodeStatus = allTasksCompleted ? "COMPLETED" : "PENDING";

  nodes.push({
    id: synthesisId,
    title: "Synthesis Scout",
    agentType: "SYNTHESIS",
    status: synthesisStatus,
    x: START_X + LEVEL_SPACING_X * 3,
    y: START_Y,
    level: 3,
    inputContext: "Combining verified claims and evidence into final research intelligence report.",
    outputPayload: allTasksCompleted ? "Final structured research report generated." : undefined,
  });

  edges.push({
    id: "edge-critic-synthesis",
    source: criticId,
    target: synthesisId,
    animated: criticStatus === "RUNNING",
    status: synthesisStatus,
  });

  return { nodes, edges };
}
