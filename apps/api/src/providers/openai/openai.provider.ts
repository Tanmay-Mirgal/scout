import { z } from "zod";
import type { AIProvider } from "../core/ai-provider.interface";
import type { ProviderRequest, ProviderResponse } from "../core/provider.types";

export class OpenAIProvider implements AIProvider {
  readonly name = "OpenAI Provider";
  readonly providerType = "OPENAI";

  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel = "gpt-4o-mini") {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || "";
    this.defaultModel = defaultModel;
  }

  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    if (!this.apiKey || this.apiKey.startsWith("mock-")) {
      return this.generateMockResponse(request);
    }

    const model = request.model || this.defaultModel;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API request failed (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    const content = data.choices[0]?.message?.content || "";

    return {
      content,
      model,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
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
          content: "Respond STRICTLY with valid JSON matching the required schema. No commentary.",
        },
      ],
    });

    const jsonMatch = rawResponse.content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    const jsonString = jsonMatch ? jsonMatch[0] : rawResponse.content;

    try {
      const parsed = JSON.parse(jsonString);
      return schema.parse(parsed);
    } catch (err: any) {
      throw new Error(`OpenAI structured JSON parsing failed: ${err.message}`);
    }
  }

  private generateMockResponse(request: ProviderRequest): ProviderResponse {
    const lastMsg = request.messages[request.messages.length - 1]?.content || "";
    return {
      content: `[OpenAI Simulated Response] Investigated query: ${lastMsg.substring(0, 100)}`,
      model: this.defaultModel,
      usage: { promptTokens: 50, completionTokens: 50, totalTokens: 100 },
    };
  }
}
