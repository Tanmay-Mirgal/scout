import { z } from "zod";
import type { AIProvider } from "../core/ai-provider.interface";
import type { ProviderRequest, ProviderResponse } from "../core/provider.types";

export class AnthropicProvider implements AIProvider {
  readonly name = "Anthropic Claude Provider";
  readonly providerType = "ANTHROPIC";

  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel = "claude-3-5-sonnet-20241022") {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || "";
    this.defaultModel = defaultModel;
  }

  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    if (!this.apiKey || this.apiKey.startsWith("mock-")) {
      return this.generateMockResponse(request);
    }

    const model = request.model || this.defaultModel;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        messages: request.messages.map((m) => ({
          role: m.role === "system" ? "user" : m.role,
          content: m.content,
        })),
        max_tokens: request.maxTokens || 1024,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API request failed (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    const content = data.content[0]?.text || "";

    return {
      content,
      model,
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
    };
  }

  async generateStructured<T>(request: ProviderRequest, schema: z.ZodType<T>): Promise<T> {
    const rawResponse = await this.generate({
      ...request,
      messages: [
        ...request.messages,
        {
          role: "user",
          content: "Respond STRICTLY with valid JSON matching the required schema. No conversational text.",
        },
      ],
    });

    const jsonMatch = rawResponse.content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    const jsonString = jsonMatch ? jsonMatch[0] : rawResponse.content;

    try {
      const parsed = JSON.parse(jsonString);
      return schema.parse(parsed);
    } catch (err: any) {
      throw new Error(`Anthropic structured JSON parsing failed: ${err.message}`);
    }
  }

  private generateMockResponse(request: ProviderRequest): ProviderResponse {
    const lastMsg = request.messages[request.messages.length - 1]?.content || "";
    return {
      content: `[Anthropic Claude Simulated Response] Investigated: ${lastMsg.substring(0, 100)}`,
      model: this.defaultModel,
      usage: { promptTokens: 60, completionTokens: 60, totalTokens: 120 },
    };
  }
}
