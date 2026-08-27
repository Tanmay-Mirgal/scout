import { Groq } from "groq-sdk";
import { z } from "zod";
import type { AIProvider } from "../core/ai-provider.interface";
import type { ProviderRequest, ProviderResponse } from "../core/provider.types";
import { env } from "../../config";

/**
 * AIProvider implementation for the Groq Cloud API.
 * Uses the official Groq SDK and maps requests/responses cleanly.
 */
export class GroqProvider implements AIProvider {
  readonly name = "Groq AI Provider";
  readonly providerType = "GROQ";
  private client: Groq | null = null;

  /**
   * Lazily instantiates the Groq SDK client on demand.
   * This allows the SCOUT API server to boot even when GROQ_API_KEY is not defined.
   */
  private getClient(): Groq {
    if (this.client) {
      return this.client;
    }

    if (!env.GROQ_API_KEY || env.GROQ_API_KEY.trim() === "") {
      const err = new Error("GROQ_API_KEY environment variable is not configured.");
      (err as any).code = "AI_PROVIDER_NOT_CONFIGURED";
      throw err;
    }

    this.client = new Groq({
      apiKey: env.GROQ_API_KEY,
    });
    return this.client;
  }

  /**
   * Clears the instantiated Groq client (useful in testing).
   */
  reset(): void {
    this.client = null;
  }

  /**
   * Executes a text completion generation query.
   */
  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    const groq = this.getClient();
    const model = request.model || env.AI_DEFAULT_MODEL || "llama-3.3-70b-versatile";

    // Build standard messages list, prepending system prompt if provided
    const apiMessages: any[] = [];
    if (request.systemPrompt) {
      apiMessages.push({
        role: "system",
        content: request.systemPrompt,
      });
    }

    request.messages.forEach((msg) => {
      apiMessages.push({
        role: msg.role,
        content: msg.content,
      });
    });

    try {
      const response = await groq.chat.completions.create({
        messages: apiMessages,
        model,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 2000,
        stream: false,
      });

      const choice = response.choices[0];
      const content = choice?.message?.content || "";
      
      const inputTokens = response.usage?.prompt_tokens ?? 0;
      const outputTokens = response.usage?.completion_tokens ?? 0;
      const totalTokens = response.usage?.total_tokens ?? 0;

      return {
        content,
        model: response.model || model,
        provider: "GROQ",
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
        },
        metadata: {
          finishReason: choice?.finish_reason,
          systemFingerprint: response.system_fingerprint,
        },
      };
    } catch (err: any) {
      // Normalize external API failure states
      const error = new Error(`Groq API invocation failed: ${err.message}`);
      (error as any).code = "AI_PROVIDER_UNAVAILABLE";
      (error as any).status = err.status;
      throw error;
    }
  }

  /**
   * Generates a structured JSON object conforming to a Zod schema.
   */
  async generateStructured<T>(request: ProviderRequest, schema: z.ZodType<T>): Promise<T> {
    const maxRetries = env.RESEARCH_AI_MAX_RETRIES ?? 3;
    let attempt = 0;

    const jsonInstruction = "\nYour output MUST be a valid JSON object strictly conforming to the requested schema format.";
    const systemPrompt = request.systemPrompt
      ? request.systemPrompt + jsonInstruction
      : "You are a helpful research assistant." + jsonInstruction;

    const modifiedRequest = {
      ...request,
      systemPrompt,
    };

    while (attempt < maxRetries) {
      attempt++;
      try {
        const groq = this.getClient();
        const model = request.model || env.AI_DEFAULT_MODEL || "llama-3.3-70b-versatile";

        const apiMessages: any[] = [];
        if (modifiedRequest.systemPrompt) {
          apiMessages.push({
            role: "system",
            content: modifiedRequest.systemPrompt,
          });
        }

        modifiedRequest.messages.forEach((msg) => {
          apiMessages.push({
            role: msg.role,
            content: msg.content,
          });
        });

        const response = await groq.chat.completions.create({
          messages: apiMessages,
          model,
          temperature: request.temperature ?? 0.1, // Low temperature for schema accuracy
          max_tokens: request.maxTokens ?? 2000,
          response_format: { type: "json_object" },
          stream: false,
        });

        const content = response.choices[0]?.message?.content || "";
        const parsed = JSON.parse(content);
        const validated = schema.parse(parsed);
        return validated;
      } catch (err: any) {
        console.error(`[AI JSON Mode Attempt ${attempt}/${maxRetries} failed]: ${err.message}`);
        
        if (attempt >= maxRetries) {
          const error = new Error(`Failed to generate valid structured JSON output after ${maxRetries} attempts: ${err.message}`);
          (error as any).code = "AI_GENERATION_FAILED";
          throw error;
        }

        // Exponential backoff wait (e.g. 500ms, 1000ms, 1500ms)
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }

    throw new Error("Unexpected end of structured generation loop.");
  }
}

export default GroqProvider;
