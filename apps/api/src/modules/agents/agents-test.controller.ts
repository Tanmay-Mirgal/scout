import type { FastifyReply, FastifyRequest } from "fastify";
import { AgentExecutionService } from "../../agents/core/agent-execution.service";
import { agentTestRequestSchema } from "./agents-test.schema";

/**
 * Controller executing development and live test queries against SCOUT agent architecture.
 */
export class AgentsTestController {
  /**
   * Resolves the requested agent type, executes query context, and handles custom response codes.
   */
  static async executeTest(request: FastifyRequest, reply: FastifyReply) {
    // Validate payload
    const body = agentTestRequestSchema.parse(request.body);

    const context = {
      researchSessionId: body.researchSessionId || "00000000-0000-0000-0000-000000000000",
      researchTaskId: body.researchTaskId || "00000000-0000-0000-0000-000000000000",
      query: body.query,
    };

    const result = await AgentExecutionService.execute(body.agentType, context);

    if (!result.success) {
      const errorCode = result.metadata?.code || "AGENT_EXECUTION_FAILED";
      
      let statusCode = 400;
      if (errorCode === "AI_PROVIDER_NOT_CONFIGURED") {
        statusCode = 424; // Failed Dependency
      } else if (errorCode === "AGENT_NOT_FOUND") {
        statusCode = 404; // Not Found
      } else if (errorCode === "AI_PROVIDER_UNAVAILABLE") {
        statusCode = 502; // Bad Gateway
      }

      return reply.status(statusCode).send({
        success: false,
        error: {
          code: errorCode,
          message: result.error || "Agent execution failed",
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: {
        output: result.output,
        usage: result.usage,
        metadata: result.metadata,
      },
    });
  }
}
export default AgentsTestController;
