import { z } from "zod";
import { BaseAgent } from "../core/base.agent";
import type { AgentContext, AgentResult } from "../core/agent.types";
import { prisma } from "../../lib/prisma";

// Strict Zod schema for validated report outputs
export const reportSynthesisSchema = z.object({
  title: z.string(),
  executiveSummary: z.string(),
  researchQuestion: z.string(),
  methodology: z.object({
    overview: z.string(),
    tasksCompleted: z.number(),
    tasksFailed: z.number(),
    sourcesAnalyzed: z.number(),
  }),
  keyFindings: z.array(
    z.object({
      finding: z.string(),
      confidence: z.number().min(0).max(1),
      citations: z.array(z.string()).describe("List of valid source IDs cited for this finding"),
    })
  ),
  detailedAnalysis: z.array(
    z.object({
      sectionTitle: z.string(),
      content: z.string(),
      citations: z.array(z.string()).describe("List of valid source IDs cited for this section"),
    })
  ),
  contradictions: z.array(
    z.object({
      topic: z.string(),
      explanation: z.string(),
      citations: z.array(z.string()),
    })
  ),
  limitations: z.array(z.string()),
  conclusion: z.string(),
});

export type ReportSynthesis = z.infer<typeof reportSynthesisSchema>;

/**
 * ReportContextBuilder retrieves structured research findings, verified claims,
 * corresponding evidence extracts, and active sources to build a clean context prompt.
 */
export class ReportContextBuilder {
  static async buildContext(sessionId: string) {
    const session = await prisma.researchSession.findUnique({
      where: { id: sessionId },
      include: { tasks: true },
    });

    if (!session) {
      throw new Error(`ResearchSession with ID '${sessionId}' was not found.`);
    }

    const tasks = session.tasks;
    const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
    const failedTasks = tasks.filter((t) => t.status === "FAILED").length;

    // Retrieve high-credibility sources
    const sources = await prisma.source.findMany({
      where: { researchSessionId: sessionId },
      orderBy: { credibilityScore: "desc" },
      take: 25, // Bounded size limit
    });

    // Retrieve claims verified as SUPPORTED
    const supportedClaims = await prisma.claim.findMany({
      where: { researchSessionId: sessionId, status: "SUPPORTED" },
      include: {
        evidence: {
          include: {
            evidence: {
              include: { source: true },
            },
          },
        },
      },
    });

    // Retrieve claims verified as CONTRADICTED
    const contradictedClaims = await prisma.claim.findMany({
      where: { researchSessionId: sessionId, status: "CONTRADICTED" },
      include: {
        evidence: {
          include: {
            evidence: {
              include: { source: true },
            },
          },
        },
      },
    });

    // Format allowable citations list
    const allowableCitations = sources.map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      publisher: s.publisher || "Unknown Publisher",
      credibilityScore: s.credibilityScore ?? 0.5,
    }));

    return {
      query: session.query,
      title: session.title,
      description: session.description || "",
      methodology: {
        tasksTotal: tasks.length,
        tasksCompleted: completedTasks,
        tasksFailed: failedTasks,
        sourcesAnalyzed: sources.length,
      },
      allowableCitations,
      supportedClaims: supportedClaims.map((c) => ({
        id: c.id,
        content: c.content,
        reasoning: c.reasoning || "",
        confidenceScore: c.confidenceScore ?? 0.5,
        evidence: c.evidence.map((ce) => ({
          content: ce.evidence.content,
          relationship: ce.relationship,
          sourceId: ce.evidence.sourceId,
          sourceTitle: ce.evidence.source.title,
        })),
      })),
      contradictedClaims: contradictedClaims.map((c) => ({
        id: c.id,
        content: c.content,
        reasoning: c.reasoning || "",
        evidence: c.evidence.map((ce) => ({
          content: ce.evidence.content,
          relationship: ce.relationship,
          sourceId: ce.evidence.sourceId,
        })),
      })),
    };
  }
}

/**
 * SynthesisAgent consolidates verified claims and evidence findings
 * into a structured final report with safety checks on source citations.
 */
export class SynthesisAgent extends BaseAgent {
  readonly name = "Synthesis Agent";
  readonly type = "SYNTHESIS";

  async execute(context: AgentContext): Promise<AgentResult> {
    const sessionId = context.researchSessionId;
    if (!sessionId) {
      return {
        success: false,
        output: "",
        error: "context.researchSessionId is required for synthesis operations.",
      };
    }

    try {
      // 1. Fetch structured findings context
      const reportContext = await ReportContextBuilder.buildContext(sessionId);

      // 2. Format LLM instruction prompts
      const provider = this.getProvider();
      const systemPrompt = `You are the SCOUT Report Synthesis Agent.
Your objective is to consolidate verified claims, evidence facts, and source assessments into a highly professional, structured research report.

Follow these strict guidelines:
1. Review the provided supported claims, contradictory findings, and limitations.
2. Build a coherent, objective narrative addressing the original research question.
3. DO NOT invent facts, statistics, or sources.
4. Any claims/findings you cite MUST reference actual source IDs from the allowable citations list.
5. If there are failed research tasks, you MUST list them as methodology limitations.
6. Return your report in JSON format conforming strictly to the requested schema.

Your output MUST be a valid JSON object matching this schema format:
{
  "title": "Title of the research report",
  "executiveSummary": "Executive summary of the report",
  "researchQuestion": "The original research question",
  "methodology": {
    "overview": "Overview of the research methodology",
    "tasksCompleted": 8, // number of completed tasks
    "tasksFailed": 0,    // number of failed tasks
    "sourcesAnalyzed": 5  // number of sources analyzed
  },
  "keyFindings": [
    {
      "finding": "Short statement of a key finding",
      "confidence": 0.95, // float between 0 and 1
      "citations": ["source-uuid-1"] // array of valid source IDs cited for this finding
    }
  ],
  "detailedAnalysis": [
    {
      "sectionTitle": "Title of this section",
      "content": "Detailed paragraphs of analytical content",
      "citations": ["source-uuid-1", "source-uuid-2"] // array of valid source IDs cited for this section
    }
  ],
  "contradictions": [
    {
      "topic": "Topic of contradiction or conflict",
      "explanation": "Explanation of contradicting findings in the sources",
      "citations": ["source-uuid-2"] // array of valid source IDs cited
    }
  ],
  "limitations": [
    "Limitation details such as missing data, scope bounds, or failed tasks"
  ],
  "conclusion": "Final concluding remarks"
}`;

      const userPrompt = `### Original Research Session Details
Question: "${reportContext.query}"
Session Title: "${reportContext.title}"
Description: "${reportContext.description}"

### Methodology Stats
Total planned tasks: ${reportContext.methodology.tasksTotal}
Completed tasks: ${reportContext.methodology.tasksCompleted}
Failed tasks: ${reportContext.methodology.tasksFailed}
Sources analyzed: ${reportContext.methodology.sourcesAnalyzed}

### Allowable Citations (Use only these source IDs):
${JSON.stringify(reportContext.allowableCitations, null, 2)}

### Verified Supported Claims:
${JSON.stringify(reportContext.supportedClaims, null, 2)}

### Contradictory Claims / Conflicts (Address these in the contradictions section):
${JSON.stringify(reportContext.contradictedClaims, null, 2)}

Generate a structured final report now. Ensure every citation ID listed in the report is a real source ID from the Allowable Citations list.`;

      // 3. Invoke LLM structured generation
      const report = await provider.generateStructured<ReportSynthesis>(
        {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        },
        reportSynthesisSchema
      );

      // 4. Validate source references to prevent hallucinated IDs
      const allowableIds = new Set(reportContext.allowableCitations.map((s) => s.id));

      const validateCitations = (citations: string[] = []): string[] => {
        return citations.filter((id) => allowableIds.has(id));
      };

      // Filter citations to make sure they match allowable IDs
      report.keyFindings = report.keyFindings.map((kf) => ({
        ...kf,
        citations: validateCitations(kf.citations),
      }));

      report.detailedAnalysis = report.detailedAnalysis.map((da) => ({
        ...da,
        citations: validateCitations(da.citations),
      }));

      report.contradictions = report.contradictions.map((c) => ({
        ...c,
        citations: validateCitations(c.citations),
      }));

      // Append limitations if tasks failed
      if (reportContext.methodology.tasksFailed > 0) {
        const limitationMsg = `Methodology Limitation: ${reportContext.methodology.tasksFailed} of the planned ${reportContext.methodology.tasksTotal} research tasks failed to execute.`;
        if (!report.limitations.includes(limitationMsg)) {
          report.limitations.unshift(limitationMsg);
        }
      }

      return {
        success: true,
        output: JSON.stringify(report),
        metadata: {
          title: report.title,
          findingsCount: report.keyFindings.length,
          limitationsCount: report.limitations.length,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        output: "",
        error: `Report synthesis failed: ${err.message}`,
        metadata: {
          code: err.code || "SYNTHESIS_FAILED",
        },
      };
    }
  }
}
export default SynthesisAgent;
