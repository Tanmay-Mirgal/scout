import { prisma } from "../lib/prisma";

export type HITLAction = "APPROVE" | "REJECT" | "MODIFY_INPUT";
export type CheckpointStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "MODIFIED";

export interface HITLCheckpoint {
  checkpointId: string;
  sessionId: string;
  agentType: string;
  stepName: string;
  stateSnapshot: Record<string, any>;
  inputParams: Record<string, any>;
  status: CheckpointStatus;
  humanAction?: HITLAction;
  modifiedInput?: Record<string, any>;
  humanFeedback?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface ReplayResult {
  checkpointId: string;
  sessionId: string;
  status: "RESUMED" | "CANCELLED";
  effectiveInput: Record<string, any>;
  executionState: Record<string, any>;
  message: string;
}

export class HITLWorkflowEngine {
  private static checkpointStore: Map<string, HITLCheckpoint> = new Map();

  /**
   * Creates a state breakpoint checkpoint that pauses agent workflow execution for human review.
   */
  public static async createCheckpoint(params: {
    sessionId: string;
    agentType: string;
    stepName: string;
    stateSnapshot: Record<string, any>;
    inputParams: Record<string, any>;
  }): Promise<HITLCheckpoint> {
    const session = await prisma.researchSession.findUnique({
      where: { id: params.sessionId },
    });

    if (!session) {
      throw new Error(`Research session with ID '${params.sessionId}' not found.`);
    }

    const checkpointId = `chk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const checkpoint: HITLCheckpoint = {
      checkpointId,
      sessionId: params.sessionId,
      agentType: params.agentType,
      stepName: params.stepName,
      stateSnapshot: params.stateSnapshot,
      inputParams: params.inputParams,
      status: "PENDING_APPROVAL",
      createdAt: new Date(),
    };

    this.checkpointStore.set(checkpointId, checkpoint);
    return checkpoint;
  }

  /**
   * Retrieves pending or all active checkpoints for a research session.
   */
  public static async getSessionCheckpoints(
    sessionId: string,
    userId: string,
    pendingOnly: boolean = false
  ): Promise<HITLCheckpoint[]> {
    const session = await prisma.researchSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new Error(`Research session with ID '${sessionId}' not found.`);
    }

    const checkpoints = Array.from(this.checkpointStore.values()).filter(
      (chk) => chk.sessionId === sessionId
    );

    if (pendingOnly) {
      return checkpoints.filter((chk) => chk.status === "PENDING_APPROVAL");
    }
    return checkpoints;
  }

  /**
   * Submits a human decision (APPROVE | REJECT | MODIFY_INPUT) for a paused workflow checkpoint.
   */
  public static async submitDecision(params: {
    sessionId: string;
    userId: string;
    checkpointId: string;
    action: HITLAction;
    modifiedInput?: Record<string, any>;
    feedback?: string;
  }): Promise<ReplayResult> {
    const session = await prisma.researchSession.findUnique({
      where: { id: params.sessionId },
    });

    if (!session || session.userId !== params.userId) {
      throw new Error(`Research session with ID '${params.sessionId}' not found.`);
    }

    const checkpoint = this.checkpointStore.get(params.checkpointId);
    if (!checkpoint || checkpoint.sessionId !== params.sessionId) {
      throw new Error(`HITL Checkpoint '${params.checkpointId}' not found for session.`);
    }

    checkpoint.humanAction = params.action;
    checkpoint.humanFeedback = params.feedback;
    checkpoint.resolvedAt = new Date();

    if (params.action === "APPROVE") {
      checkpoint.status = "APPROVED";
      return {
        checkpointId: checkpoint.checkpointId,
        sessionId: checkpoint.sessionId,
        status: "RESUMED",
        effectiveInput: checkpoint.inputParams,
        executionState: checkpoint.stateSnapshot,
        message: "Workflow resumed with original approved inputs.",
      };
    } else if (params.action === "MODIFY_INPUT") {
      checkpoint.status = "MODIFIED";
      checkpoint.modifiedInput = params.modifiedInput || checkpoint.inputParams;
      return {
        checkpointId: checkpoint.checkpointId,
        sessionId: checkpoint.sessionId,
        status: "RESUMED",
        effectiveInput: checkpoint.modifiedInput,
        executionState: { ...checkpoint.stateSnapshot, ...checkpoint.modifiedInput },
        message: "Workflow resumed with user-modified inputs.",
      };
    } else {
      checkpoint.status = "REJECTED";
      return {
        checkpointId: checkpoint.checkpointId,
        sessionId: checkpoint.sessionId,
        status: "CANCELLED",
        effectiveInput: checkpoint.inputParams,
        executionState: checkpoint.stateSnapshot,
        message: "Workflow execution cancelled by human intervention.",
      };
    }
  }

  /**
   * Clears the in-memory checkpoint store (primarily used during test resets).
   */
  public static clearStore(): void {
    this.checkpointStore.clear();
  }
}
