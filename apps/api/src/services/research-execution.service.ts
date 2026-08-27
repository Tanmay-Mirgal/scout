import { prisma } from "../lib/prisma";
import { AgentExecutionService } from "../agents/core/agent-execution.service";
import { ContentFetcher } from "../lib/content-fetcher";
import { env } from "../config";

/**
 * Helper to execute an agent run, track its start/end state, and log inputs/outputs in Prisma.
 */
async function executeAgentStep(
  agentType: string,
  taskId: string,
  sessionId: string,
  query: string,
  contextData?: string
): Promise<any> {
  const agentTypeMap: Record<string, string> = {
    ORCHESTRATOR: "ORCHESTRATOR",
    RESEARCH: "RESEARCH",
    SOURCE: "SOURCE",
    EVIDENCE: "DATA",
    CLAIM: "SYNTHESIS",
    CRITIC: "CRITIC",
  };

  const dbAgentType = agentTypeMap[agentType.toUpperCase()] || agentType;

  const agentRun = await prisma.agentRun.create({
    data: {
      researchSessionId: sessionId,
      researchTaskId: taskId,
      agentType: dbAgentType as any,
      status: "RUNNING",
      input: { query, context: contextData } as any,
      startedAt: new Date(),
    },
  });

  if (!agentRun) {
    console.error(`⚠️ prisma.agentRun.create returned undefined for agent: ${agentType}`);
  }

  try {
    const res = await AgentExecutionService.execute(agentType, {
      researchSessionId: sessionId,
      researchTaskId: taskId,
      query,
      context: contextData,
    });

    if (!res.success) {
      await prisma.agentRun.update({
        where: { id: agentRun.id },
        data: {
          status: "FAILED",
          error: res.error || "Agent execution failed",
          completedAt: new Date(),
        },
      });
      throw new Error(res.error || "Agent execution failed");
    }

    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: {
        status: "COMPLETED",
        output: res.output ? JSON.parse(res.output) : null,
        metadata: res.metadata as any,
        completedAt: new Date(),
      },
    });

    return res.output ? JSON.parse(res.output) : null;
  } catch (err: any) {
    if (agentRun) {
      await prisma.agentRun.update({
        where: { id: agentRun.id },
        data: {
          status: "FAILED",
          error: err.message,
          completedAt: new Date(),
        },
      });
    }
    throw err;
  }
}

/**
 * Service managing the execution loops of SCOUT research sessions.
 * Coordinates task execution, candidate web discoveries,
 * source credibility assessments, fact extractions, and claims verifications.
 */
export class ResearchExecutionService {
  /**
   * Executes a single planned research task, updating its status dynamically.
   * Runs sequentially through web search, domain score, scraped text crawler,
   * evidence facts extraction, claim synthesis, and critic verification mapping.
   */
  static async executeTask(sessionId: string, taskId: string) {
    const task = await prisma.researchTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`ResearchTask with ID '${taskId}' was not found.`);
    }

    if (task.status === "COMPLETED") {
      console.log(`[Execution] Task ${taskId} is already completed. Skipping.`);
      return;
    }

    // Mark task as IN_PROGRESS
    await prisma.researchTask.update({
      where: { id: taskId },
      data: { status: "IN_PROGRESS" },
    });

    try {
      // Step 1: ResearchAgent (Type: RESEARCH) - Web Search Query execution
      const candidateResults = await executeAgentStep(
        "RESEARCH",
        task.id,
        sessionId,
        task.title,
        task.description || ""
      );

      // Clamp number of processed sources per task
      const maxSources = env.RESEARCH_MAX_SOURCES_PER_TASK ?? 5;
      const candidateSlice = (candidateResults || []).slice(0, maxSources);

      for (const candidate of candidateSlice) {
        if (!candidate.url) continue;

        // Deduplicate based on URL
        const normalizedUrl = candidate.url.toLowerCase().trim().replace(/\/$/, "");
        let existingSource = await prisma.source.findFirst({
          where: {
            researchSessionId: sessionId,
            url: { equals: normalizedUrl, mode: "insensitive" },
          },
        });

        let sourceId = existingSource?.id;

        if (!existingSource) {
          // Step 2: SourceAgent (Type: SOURCE) - Credibility check
          const evaluation = await executeAgentStep(
            "SOURCE",
            task.id,
            sessionId,
            task.title,
            JSON.stringify(candidate)
          );

          // Skip sources evaluated as irrelevant
          if (!evaluation.relevant) {
            continue;
          }

          // Fetch raw website contents if Tavily rawContent is missing
          let content = candidate.rawContent || "";
          if (content.trim() === "") {
            content = await ContentFetcher.fetchContent(candidate.url);
          }

          // Clamp raw page text to max content size limit
          const maxContentSize = env.RESEARCH_MAX_SOURCE_CONTENT_SIZE ?? 100000;
          if (content.length > maxContentSize) {
            content = content.substring(0, maxContentSize);
          }

          // Save new Source row
          const createdSource = await prisma.source.create({
            data: {
              researchSessionId: sessionId,
              title: candidate.title || "Untitled Web Resource",
              url: normalizedUrl,
              publisher: candidate.publisher || null,
              publishedAt: candidate.publishedAt ? new Date(candidate.publishedAt) : null,
              accessedAt: new Date(),
              sourceType: evaluation.sourceType || "WEBSITE",
              credibilityScore: evaluation.credibilityScore ?? 0.5,
              metadata: evaluation as any,
            },
          });
          sourceId = createdSource.id;

          // Step 3: EvidenceAgent (Type: DATA) - Facts Extraction
          const extractedFacts = await executeAgentStep(
            "EVIDENCE", // Mapped to DATA db enum via mapping
            task.id,
            sessionId,
            task.title,
            content
          );

          const evidenceList = extractedFacts.evidence || [];
          const savedEvidence: any[] = [];

          for (const fact of evidenceList) {
            const evidenceRecord = await prisma.evidence.create({
              data: {
                researchSessionId: sessionId,
                sourceId: createdSource.id,
                content: fact.content,
                summary: fact.summary || null,
                location: fact.location || null,
                relevanceScore: fact.relevanceScore ?? 0.5,
                confidenceScore: fact.confidenceScore ?? 0.5,
              },
            });
            savedEvidence.push(evidenceRecord);
          }

          if (savedEvidence.length > 0) {
            // Step 4: ClaimAgent (Type: SYNTHESIS) - Claim synthesis
            const synthesizedClaims = await executeAgentStep(
              "CLAIM", // Mapped to SYNTHESIS db enum via mapping
              task.id,
              sessionId,
              task.title,
              JSON.stringify(savedEvidence)
            );

            const claimsList = synthesizedClaims.claims || [];
            for (const claimItem of claimsList) {
              await prisma.claim.create({
                data: {
                  researchSessionId: sessionId,
                  content: claimItem.content,
                  status: "UNVERIFIED",
                  reasoning: claimItem.reasoning || null,
                },
              });
            }
          }
        }
      }

      // Step 5: CriticAgent (Type: CRITIC) - Claims Verification
      const sessionClaims = await prisma.claim.findMany({
        where: { researchSessionId: sessionId, status: "UNVERIFIED" },
      });

      const allSessionEvidence = await prisma.evidence.findMany({
        where: { researchSessionId: sessionId },
      });

      if (sessionClaims.length > 0 && allSessionEvidence.length > 0) {
        for (const claim of sessionClaims) {
          const verification = await executeAgentStep(
            "CRITIC", // Mapped to CRITIC db enum
            task.id,
            sessionId,
            claim.content,
            JSON.stringify(allSessionEvidence)
          );

          // Save ClaimEvidence relationships in bulk
          const mappingsList = verification.mappings || [];
          for (const mapItem of mappingsList) {
            const mappedEvidence = allSessionEvidence[mapItem.evidenceIndex];
            if (mappedEvidence) {
              // Avoid relationship duplicates
              await prisma.claimEvidence.upsert({
                where: {
                  claimId_evidenceId: {
                    claimId: claim.id,
                    evidenceId: mappedEvidence.id,
                  },
                },
                create: {
                  claimId: claim.id,
                  evidenceId: mappedEvidence.id,
                  relationship: mapItem.relationship,
                  strength: mapItem.strength ?? 0.5,
                  notes: mapItem.reasoning || null,
                },
                update: {
                  relationship: mapItem.relationship,
                  strength: mapItem.strength ?? 0.5,
                  notes: mapItem.reasoning || null,
                },
              });
            }
          }

          // Update verified Claim status
          await prisma.claim.update({
            where: { id: claim.id },
            data: {
              status: verification.status || "INSUFFICIENT_EVIDENCE",
              confidenceScore: verification.confidenceScore ?? 0.0,
              reasoning: verification.reasoning || null,
            },
          });
        }
      }

      // Task completed successfully
      await prisma.researchTask.update({
        where: { id: taskId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });
    } catch (err: any) {
      console.error(`❌ Task execution failed for: "${task.title}": ${err.message}`, err.stack);
      await prisma.researchTask.update({
        where: { id: taskId },
        data: { status: "FAILED" },
      });
      throw err;
    }
  }

  /**
   * Runs sequentially through all PENDING research tasks of a session.
   * Tracks and commits execution results, preventing duplicate concurrent runs.
   * Retained for backward compatibility and synchronous local execution testing.
   */
  static async executeSession(sessionId: string, developerUserId: string) {
    // 1. Retrieve and validate session
    const session = await prisma.researchSession.findUnique({
      where: { id: sessionId },
      include: { tasks: true },
    });

    if (!session) {
      const err = new Error(`ResearchSession with ID '${sessionId}' was not found.`);
      (err as any).code = "RESEARCH_SESSION_NOT_FOUND";
      throw err;
    }

    // Verify developer user ownership
    if (session.userId !== developerUserId) {
      const err = new Error("Unauthorized access to research session.");
      (err as any).code = "UNAUTHORIZED";
      throw err;
    }

    if (session.tasks.length === 0) {
      const err = new Error("No tasks are planned for this research session. Plan first.");
      (err as any).code = "RESEARCH_PLAN_NOT_FOUND";
      throw err;
    }

    // 2. Idempotency Check: Prevent duplicate concurrent executions
    if (session.status === "IN_PROGRESS") {
      const err = new Error("This research session execution is already in progress.");
      (err as any).code = "CONFLICT";
      throw err;
    }

    // Lock session into IN_PROGRESS
    await prisma.researchSession.update({
      where: { id: sessionId },
      data: { status: "IN_PROGRESS" },
    });

    const pendingTasks = await prisma.researchTask.findMany({
      where: {
        researchSessionId: sessionId,
        status: "PENDING",
      },
      orderBy: { createdAt: "asc" },
    });

    let completedTasks = 0;
    let failedTasks = 0;

    // Loop through tasks sequentially to enforce controlled execution
    for (const task of pendingTasks) {
      try {
        await this.executeTask(sessionId, task.id);
        completedTasks++;
      } catch (err) {
        failedTasks++;
      }
    }

    // Determine final session status
    let finalSessionStatus: "COMPLETED" | "FAILED" = "COMPLETED";
    if (completedTasks === 0 && failedTasks > 0) {
      finalSessionStatus = "FAILED";
    }

    await prisma.researchSession.update({
      where: { id: sessionId },
      data: {
        status: finalSessionStatus,
        completedAt: finalSessionStatus === "COMPLETED" ? new Date() : null,
      },
    });

    // 7. Retrieve execution statistics
    const sourcesCount = await prisma.source.count({ where: { researchSessionId: sessionId } });
    const evidenceCount = await prisma.evidence.count({ where: { researchSessionId: sessionId } });
    const totalClaims = await prisma.claim.count({ where: { researchSessionId: sessionId } });
    const supportedClaims = await prisma.claim.count({
      where: { researchSessionId: sessionId, status: "SUPPORTED" },
    });
    const contradictedClaims = await prisma.claim.count({
      where: { researchSessionId: sessionId, status: "CONTRADICTED" },
    });
    const insufficientClaims = await prisma.claim.count({
      where: { researchSessionId: sessionId, status: "INSUFFICIENT_EVIDENCE" },
    });

    return {
      researchSessionId: sessionId,
      tasks: {
        total: pendingTasks.length,
        completed: completedTasks,
        failed: failedTasks,
      },
      sources: sourcesCount,
      evidence: evidenceCount,
      claims: {
        total: totalClaims,
        supported: supportedClaims,
        contradicted: contradictedClaims,
        insufficientEvidence: insufficientClaims,
      },
    };
  }
}
export default ResearchExecutionService;
