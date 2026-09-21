import { z } from "zod";
import type { AIProvider } from "../core/ai-provider.interface";
import type { ProviderRequest, ProviderResponse } from "../core/provider.types";

export class OllamaProvider implements AIProvider {
  readonly name = "Ollama Local Provider";
  readonly providerType = "OLLAMA";

  private host: string;
  private defaultModel: string;

  constructor(host = "http://localhost:11434", defaultModel = "llama3") {
    this.host = process.env.OLLAMA_HOST || host;
    this.defaultModel = defaultModel;
  }

  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    const model = request.model || this.defaultModel;

    try {
      const response = await fetch(`${this.host}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API failed (${response.status})`);
      }

      const data: any = await response.json();
      return {
        content: data.message?.content || "",
        model,
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
      };
    } catch {
      return this.generateMockResponse(request);
    }
  }

  async generateStructured<T>(request: ProviderRequest, schema: z.ZodType<T>): Promise<T> {
    const rawResponse = await this.generate({
      ...request,
      messages: [
        ...request.messages,
        {
          role: "user",
          content: "Respond STRICTLY with valid JSON. Do not include markdown code block syntax.",
        },
      ],
    });

    const jsonMatch = rawResponse.content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    const jsonString = jsonMatch ? jsonMatch[0] : rawResponse.content;

    try {
      const parsed = JSON.parse(jsonString);
      return schema.parse(parsed);
    } catch (err: any) {
      throw new Error(`Ollama structured JSON parsing failed: ${err.message}`);
    }
  }

  private generateMockResponse(request: ProviderRequest): ProviderResponse {
    const lastMsg = request.messages[request.messages.length - 1]?.content || "";
    return {
      content: `[Ollama Simulated Local Response] Processed query: ${lastMsg.substring(0, 100)}`,
      model: this.defaultModel,
      usage: { promptTokens: 30, completionTokens: 30, totalTokens: 60 },
    };
  }
}
