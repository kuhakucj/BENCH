import { getModelConfig } from "./config";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface ModelClient {
  readonly provider: string;
  completeJson<T>(messages: ChatMessage[], fallback: T): Promise<T>;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Model response did not contain JSON.");
  return JSON.parse(match[0]);
}

export function createModelClient(): ModelClient {
  const config = getModelConfig();

  return {
    provider: config.provider,
    async completeJson<T>(messages: ChatMessage[], fallback: T): Promise<T> {
      if (config.provider !== "nosana" || !config.endpoint) {
        return fallback;
      }

      const response = await fetch(config.endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.2,
          chat_template_kwargs: { enable_thinking: false },
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        throw new Error(`Nosana inference failed: ${response.status} ${await response.text()}`);
      }

      const payload = await response.json();
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("Nosana response did not include assistant content.");
      return extractJson(content) as T;
    }
  };
}
