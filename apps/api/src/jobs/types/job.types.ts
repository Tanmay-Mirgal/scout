export type JobType = "RESEARCH_TASK" | "SYNTHESIS";

export interface ResearchTaskJobPayload {
  type: "RESEARCH_TASK";
  researchSessionId: string;
  researchTaskId: string;
}

export interface SynthesisJobPayload {
  type: "SYNTHESIS";
  researchSessionId: string;
}

export type JobPayload = ResearchTaskJobPayload | SynthesisJobPayload;
